import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { categories } from '../lib/services';

type Blackout = { id: number; start_date: string; end_date: string; start_time: string | null; end_time: string | null; type: 'unavailable' | 'holiday'; label: string | null };
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type Booking = {
  id: string;
  slot_id: number;
  customer_name: string;
  phone: string;
  email: string | null;
  treatment: string;
  customer_notes: string | null;
  admin_notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
};
type Overview = { admin: { authenticated: true }; blackouts: Blackout[]; bookings: Booking[] };
type ApiError = { error?: string };
type AuthState = 'loading' | 'ready' | 'signin' | 'unconfigured' | 'error';

const statuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const statusLabels: Record<BookingStatus, string> = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No show' };

function isoOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function prettyDate(value: string) {
  const date = new Date(value + 'T12:00:00');
  if (!value || Number.isNaN(date.getTime())) return 'Choose a date';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function lastStartTime(durationMinutes: number) {
  const value = 10 * 60 + Math.floor(((22 * 60 - durationMinutes) - 10 * 60) / 30) * 30;
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const data = await response.json() as T & ApiError;
  if (!response.ok) {
    const error = new Error(data.error || 'Unable to complete this action.') as Error & { status?: number; data?: ApiError };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function BookingRow({ booking, onChanged }: { booking: Booking; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [appointmentDate, setAppointmentDate] = useState(booking.slot_date);
  const [appointmentTime, setAppointmentTime] = useState(booking.start_time);
  const [notes, setNotes] = useState(booking.admin_notes ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(booking.status);
    setAppointmentDate(booking.slot_date);
    setAppointmentTime(booking.start_time);
    setNotes(booking.admin_notes ?? '');
  }, [booking]);

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/bookings/' + booking.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, date: appointmentDate, startTime: appointmentTime, adminNotes: notes }),
      });
      onChanged(result.message);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : 'Unable to update booking.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Permanently delete this booking record?')) return;
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/bookings/' + booking.id, { method: 'DELETE' });
      onChanged(result.message);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : 'Unable to delete booking.');
    } finally {
      setBusy(false);
    }
  }

  return <tr>
    <td data-label="Appointment">
      <strong className="admin-table-date">{prettyDate(appointmentDate)}</strong>
      <div className="admin-appointment-fields">
        <input aria-label={'Appointment date for ' + booking.customer_name} type="date" value={appointmentDate} onChange={event => setAppointmentDate(event.target.value)}/>
        <input aria-label={'Start time for ' + booking.customer_name} type="time" min="10:00" max={lastStartTime(booking.duration_minutes)} step="1800" value={appointmentTime} onChange={event => setAppointmentTime(event.target.value)}/>
      </div>
      <small>{booking.duration_minutes} min treatment</small>
    </td>
    <td data-label="Customer">
      <strong className="admin-table-customer">{booking.customer_name}</strong>
      <a href={'tel:' + booking.phone}>{booking.phone}</a>
      {booking.email && <a href={'mailto:' + booking.email}>{booking.email}</a>}
      <small>Ref {booking.id.slice(0, 8).toUpperCase()}</small>
    </td>
    <td data-label="Treatment">
      <strong>{booking.treatment}</strong>
      {booking.customer_notes && <span className="admin-customer-note" title={booking.customer_notes}>Customer: {booking.customer_notes}</span>}
    </td>
    <td data-label="Status">
      <select className={'admin-status-select ' + status} aria-label={'Status for ' + booking.customer_name} value={status} onChange={event => setStatus(event.target.value as BookingStatus)}>{statuses.map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select>
    </td>
    <td data-label="Private note">
      <input className="admin-note-input" aria-label={'Private note for ' + booking.customer_name} maxLength={600} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add a note"/>
    </td>
    <td data-label="Actions">
      <div className="admin-row-actions"><button className="button admin-save" type="button" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button><button className="admin-delete" type="button" disabled={busy} onClick={remove}>Delete</button></div>
    </td>
  </tr>;
}

export default function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState(isoOffset(-365));
  const [to, setTo] = useState(isoOffset(730));
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [blockType, setBlockType] = useState<'unavailable' | 'holiday'>('unavailable');
  const [blockStartDate, setBlockStartDate] = useState(isoOffset(1));
  const [blockEndDate, setBlockEndDate] = useState(isoOffset(1));
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockLabel, setBlockLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const refreshSequence = useRef(0);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualTreatment, setManualTreatment] = useState('');
  const [manualDate, setManualDate] = useState(isoOffset(1));
  const [manualTime, setManualTime] = useState('10:00');
  const [manualNotes, setManualNotes] = useState('');
  const manualTreatmentDetails = useMemo(() => categories.flatMap(category => category.treatments).find(item => item.name === manualTreatment), [manualTreatment]);

  const refresh = useCallback(async (message = '') => {
    const requestId = ++refreshSequence.current;
    setNotice(message);
    if (!from || !to || from > to) {
      setNotice('Choose a valid date range. The From date must be before the To date.');
      setBookingsLoading(false);
      return;
    }
    setBookingsLoading(true);
    try {
      const data = await api<Overview>('/api/admin/overview?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
      if (requestId !== refreshSequence.current) return;
      setOverview(data);
      setAuthState('ready');
    } catch (error) {
      if (requestId !== refreshSequence.current) return;
      const typed = error as Error & { status?: number; data?: ApiError };
      if (typed.status === 401) setAuthState('signin');
      else if (typed.status === 503 && typed.data?.error === 'admin_not_configured') setAuthState('unconfigured');
      else {
        setNotice(typed.message);
        setAuthState(current => current === 'ready' ? current : 'error');
      }
    } finally {
      if (requestId === refreshSequence.current) setBookingsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 180); return () => window.clearTimeout(timer); }, [refresh]);

  const visibleBookings = useMemo(() => overview?.bookings.filter(booking => filter === 'all' || booking.status === filter) ?? [], [overview, filter]);
  const stats = useMemo(() => ({
    pending: overview?.bookings.filter(item => item.status === 'pending').length ?? 0,
    confirmed: overview?.bookings.filter(item => item.status === 'confirmed').length ?? 0,
    total: overview?.bookings.length ?? 0,
    holidays: overview?.blackouts.filter(item => item.type === 'holiday').length ?? 0,
  }), [overview]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      await api<{ authenticated: true }>('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      setLoginPassword('');
      await refresh();
    } catch (error) {
      const typed = error as Error & { status?: number; data?: ApiError };
      if (typed.status === 503 && typed.data?.error === 'admin_not_configured') setAuthState('unconfigured');
      else setLoginError(typed.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function signOut() {
    try {
      await api<{ authenticated: false }>('/api/admin/logout', { method: 'POST' });
    } finally {
      setOverview(null);
      setAuthState('signin');
      setNotice('');
    }
  }


  async function addManualBooking(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: manualName,
          phone: manualPhone,
          email: manualEmail,
          treatment: manualTreatment,
          date: manualDate,
          startTime: manualTime,
          adminNotes: manualNotes,
        }),
      });
      setManualName('');
      setManualPhone('');
      setManualEmail('');
      setManualNotes('');
      await refresh(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to add this booking.');
    } finally {
      setBusy(false);
    }
  }

  async function addBlackout(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/blackouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: blockType, startDate: blockStartDate, endDate: blockEndDate, startTime: blockStartTime, endTime: blockEndTime, label: blockLabel }),
      });
      setBlockLabel('');
      await refresh(result.message + ' Existing bookings remain visible so you can contact affected customers.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to add unavailable time.');
    } finally {
      setBusy(false);
    }
  }

  async function removeBlackout(id: number) {
    if (!window.confirm('Remove this unavailable period?')) return;
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/blackouts/' + id, { method: 'DELETE' });
      await refresh(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to remove unavailable period.');
    } finally {
      setBusy(false);
    }
  }

  if (authState === 'loading') return <main className="admin-page"><div className="admin-auth-card"><p className="eyebrow">SALON ADMIN</p><h1>Opening your dashboard…</h1><p>Checking your secure sign-in.</p></div></main>;
  if (authState === 'signin') return <main className="admin-page"><div className="admin-auth-card"><p className="eyebrow">SALON ADMIN</p><h1>Manage every<br/><em>appointment.</em></h1><p>Enter the salon admin password to manage bookings, appointment slots, holidays and unavailable times.</p><form className="admin-login-form" onSubmit={signIn}><label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" required minLength={8} maxLength={256} autoFocus value={loginPassword} onChange={event => setLoginPassword(event.target.value)}/>{loginError && <p className="admin-auth-error" role="alert">{loginError}</p>}<button className="button" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in...' : 'Sign in'}</button></form><a className="text-link" href="/">Return to website</a></div></main>;
  if (authState === 'unconfigured') return <main className="admin-page"><div className="admin-auth-card"><p className="eyebrow">SETUP REQUIRED</p><h1>Add the salon password.</h1><p>The dashboard is ready. Add ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET to the site's secure runtime settings.</p><a className="text-link" href="/">Return to website</a></div></main>;
  if (authState === 'error' || !overview) return <main className="admin-page"><div className="admin-auth-card"><p className="eyebrow">ADMIN DASHBOARD</p><h1>Unable to load the dashboard.</h1><p>{notice || 'Please try again.'}</p><button className="button" type="button" onClick={() => void refresh()}>Try again</button></div></main>;

  return <main className="admin-page">
    <section className="admin-hero">
      <div><p className="eyebrow">NG AESTHETICS / SALON ADMIN</p><h1>Bookings,<br/><em>beautifully organised.</em></h1><p>Secure salon session</p></div>
      <div className="admin-hero-actions"><a className="button outline" href="/" target="_blank" rel="noopener noreferrer">View customer site</a><button className="text-link admin-signout" type="button" onClick={() => void signOut()}>Sign out</button></div>
    </section>

    <section className="admin-content">
      {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
      <div className="admin-stats">
        <div><small>PENDING REQUESTS</small><strong>{stats.pending}</strong></div>
        <div><small>CONFIRMED</small><strong>{stats.confirmed}</strong></div>
        <div><small>TOTAL APPOINTMENTS</small><strong>{stats.total}</strong></div>
        <div><small>HOLIDAYS</small><strong>{stats.holidays}</strong></div>
      </div>

      <section className="admin-section manual-booking-section" aria-labelledby="manual-booking-title">
        <div className="admin-section-heading"><div><p className="eyebrow">DIRECT BOOKINGS</p><h2 id="manual-booking-title">Add a customer booking</h2><p>Use this when a customer books with you by WhatsApp, phone, social media, or another message. The appointment is added as confirmed. Add only customers who agreed to receive booking updates by SMS.</p></div><span className="status-pill confirmed">CONFIRMED</span></div>
        <form className="admin-manual-booking-form" onSubmit={addManualBooking}>
          <label>Customer name <span>*</span><input required maxLength={80} autoComplete="off" value={manualName} onChange={event => setManualName(event.target.value)}/></label>
          <label>Phone number <span>*</span><input required maxLength={30} inputMode="tel" placeholder="+44" value={manualPhone} onChange={event => setManualPhone(event.target.value)}/></label>
          <label>Email <small>optional</small><input type="email" maxLength={120} value={manualEmail} onChange={event => setManualEmail(event.target.value)}/></label>
          <label>Treatment <span>*</span><select required value={manualTreatment} onChange={event => { setManualTreatment(event.target.value); setManualTime('10:00'); }}><option value="">Choose a treatment</option>{categories.map(category => <optgroup label={category.name} key={category.slug}>{category.treatments.map(item => <option value={item.name} key={item.name}>{item.name} · {item.durationMinutes} min</option>)}</optgroup>)}</select></label>
          <label>Date <span>*</span><input type="date" min={isoOffset(0)} required value={manualDate} onChange={event => setManualDate(event.target.value)}/></label>
          <label>Start time <small>{manualTreatmentDetails ? 'latest ' + lastStartTime(manualTreatmentDetails.durationMinutes) : '10:00–22:00'}</small><input type="time" min="10:00" max={lastStartTime(manualTreatmentDetails?.durationMinutes ?? 15)} step="1800" required value={manualTime} onChange={event => setManualTime(event.target.value)}/></label>
          <label className="full">Private note <small>optional</small><textarea rows={3} maxLength={600} placeholder="For example: booked through WhatsApp" value={manualNotes} onChange={event => setManualNotes(event.target.value)}/></label>
          <button className="button full" type="submit" disabled={busy || !manualTreatment}>{busy ? 'Adding booking…' : 'Add confirmed booking'}</button>
        </form>
      </section>

      <section className="admin-section" aria-labelledby="manage-bookings-title">
        <div className="admin-section-heading">
          <div><p className="eyebrow">BOOKING MANAGEMENT</p><h2 id="manage-bookings-title">Customer appointments</h2></div>
          <div className="admin-filters">
            <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
            <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
            <label>Status<select value={filter} onChange={event => setFilter(event.target.value as 'all' | BookingStatus)}><option value="all">All bookings</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <button className="button small" type="button" disabled={bookingsLoading} onClick={() => void refresh()}>{bookingsLoading ? 'Loading...' : 'Refresh'}</button>
          </div>
        </div>
        <div className="admin-results-summary"><span>{visibleBookings.length} {visibleBookings.length === 1 ? 'appointment' : 'appointments'}</span><small>{prettyDate(from)} to {prettyDate(to)}</small></div>
        <div className="admin-bookings-table-wrap" aria-busy={bookingsLoading}>
          {bookingsLoading && <div className="admin-table-loading" role="status">Updating bookings...</div>}
          {visibleBookings.length ? <table className="admin-bookings-table">
            <thead><tr><th>Appointment</th><th>Customer</th><th>Treatment</th><th>Status</th><th>Private note</th><th>Actions</th></tr></thead>
            <tbody>{visibleBookings.map(booking => <BookingRow key={booking.id} booking={booking} onChanged={message => void refresh(message)}/>)}</tbody>
          </table> : <div className="admin-empty">No bookings match this date range and status.</div>}
        </div>
      </section>

      <section className="admin-section availability-manager" aria-labelledby="availability-title">
        <div className="admin-section-heading"><div><p className="eyebrow">AVAILABILITY</p><h2 id="availability-title">Your regular working week</h2><p>Customer times are created automatically for every treatment. Add only the dates or hours when the salon is closed.</p></div></div>
        <div className="admin-schedule-summary"><div><small>REGULAR DAYS</small><strong>Monday to Sunday</strong></div><div><small>REGULAR HOURS</small><strong>10:00–22:00</strong></div><p>Appointment lengths are set by treatment, with new start times every 30 minutes.</p></div>
        <div className="admin-tools-grid single">
          <form className="admin-tool-card holiday-card" onSubmit={addBlackout}>
            <span className="tool-number">01</span><h3>Mark unavailable</h3><p>Close a few hours, a full day, or add a holiday date range.</p>
            <div className="admin-form-grid">
              <label className="full">Type<select value={blockType} onChange={event => setBlockType(event.target.value as 'unavailable' | 'holiday')}><option value="unavailable">Not available</option><option value="holiday">Holiday</option></select></label>
              <label>From date<input type="date" min={isoOffset(0)} required value={blockStartDate} onChange={event => { setBlockStartDate(event.target.value); if (blockEndDate < event.target.value) setBlockEndDate(event.target.value); }}/></label>
              <label>To date<input type="date" min={blockStartDate} required value={blockEndDate} onChange={event => setBlockEndDate(event.target.value)}/></label>
              <label>From time <small>optional</small><input type="time" value={blockStartTime} onChange={event => setBlockStartTime(event.target.value)}/></label>
              <label>To time <small>optional</small><input type="time" value={blockEndTime} onChange={event => setBlockEndTime(event.target.value)}/></label>
              <label className="full">Label <small>optional</small><input maxLength={100} value={blockLabel} onChange={event => setBlockLabel(event.target.value)} placeholder={blockType === 'holiday' ? 'Summer holiday' : 'Personal appointment'}/></label>
            </div>
            <button className="button" type="submit" disabled={busy}>{blockType === 'holiday' ? 'Add holiday' : 'Mark unavailable'}</button>
          </form>
        </div>
      </section>

      <section className="admin-section admin-diary" aria-labelledby="diary-title">
        <div className="admin-section-heading"><div><p className="eyebrow">DIARY CONTROL</p><h2 id="diary-title">Closures and holidays</h2></div></div>
        <div className="admin-diary-grid single">
          <div>
            <h3>Unavailable and holidays</h3>
            <div className="admin-list">{overview.blackouts.length ? overview.blackouts.map(item => <div className={'admin-list-row blackout ' + item.type} key={item.id}><div><span>{item.type === 'holiday' ? 'HOLIDAY' : 'NOT AVAILABLE'}</span><strong>{prettyDate(item.start_date)}{item.end_date !== item.start_date ? ' — ' + prettyDate(item.end_date) : ''}</strong><small>{item.start_time && item.end_time ? item.start_time + '–' + item.end_time : 'Full day'}{item.label ? ' · ' + item.label : ''}</small></div><button type="button" disabled={busy} onClick={() => void removeBlackout(item.id)}>Remove</button></div>) : <div className="admin-empty">No closures or holidays in this date range.</div>}</div>
          </div>
        </div>
      </section>
    </section>
  </main>;
}
