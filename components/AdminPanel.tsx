import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type Slot = { id: number; slot_date: string; start_time: string; duration_minutes: number; status: 'available' | 'unavailable'; note: string | null };
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
type Overview = { admin: { authenticated: true }; slots: Slot[]; blackouts: Blackout[]; bookings: Booking[] };
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
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00'));
}

function slotLabel(slot: Slot) {
  return prettyDate(slot.slot_date) + ' · ' + slot.start_time + ' · ' + slot.duration_minutes + ' min';
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

function BookingCard({ booking, slots, blockedSlotIds, onChanged }: { booking: Booking; slots: Slot[]; blockedSlotIds: Set<number>; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [slotId, setSlotId] = useState(String(booking.slot_id));
  const [notes, setNotes] = useState(booking.admin_notes ?? '');
  const [busy, setBusy] = useState(false);
  const choices = slots.filter(slot => slot.status === 'available' && (slot.id === booking.slot_id || !blockedSlotIds.has(slot.id)));

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/bookings/' + booking.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, slotId: Number(slotId), adminNotes: notes }),
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
      setBusy(false);
    }
  }

  return <article className="admin-booking-card">
    <div className="admin-booking-top">
      <div><span className={'status-pill ' + booking.status}>{statusLabels[booking.status]}</span><h3>{booking.customer_name}</h3><p>{booking.treatment}</p></div>
      <div className="booking-date-block"><strong>{prettyDate(booking.slot_date)}</strong><span>{booking.start_time} · {booking.duration_minutes} min</span></div>
    </div>
    <div className="admin-customer-grid">
      <a href={'tel:' + booking.phone}><small>PHONE</small><strong>{booking.phone}</strong></a>
      <a href={booking.email ? 'mailto:' + booking.email : undefined} aria-disabled={!booking.email}><small>EMAIL</small><strong>{booking.email || 'Not supplied'}</strong></a>
      <div><small>REFERENCE</small><strong>{booking.id.slice(0, 8).toUpperCase()}</strong></div>
    </div>
    {booking.customer_notes && <div className="customer-note"><small>CUSTOMER NOTE</small><p>{booking.customer_notes}</p></div>}
    <div className="admin-edit-grid">
      <label>Status<select value={status} onChange={event => setStatus(event.target.value as BookingStatus)}>{statuses.map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
      <label>Appointment time<select value={slotId} onChange={event => setSlotId(event.target.value)}>{choices.map(slot => <option key={slot.id} value={slot.id}>{slotLabel(slot)}</option>)}</select></label>
      <label className="full">Private admin note<textarea rows={2} maxLength={600} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Visible only in the admin panel"/></label>
    </div>
    <div className="admin-card-actions"><button className="button small" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button><button className="admin-delete" type="button" disabled={busy} onClick={remove}>Delete booking</button></div>
  </article>;
}

export default function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState(isoOffset(-90));
  const [to, setTo] = useState(isoOffset(365));
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [slotDate, setSlotDate] = useState(isoOffset(1));
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('60');
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

  const refresh = useCallback(async (message = '') => {
    setNotice(message);
    try {
      const data = await api<Overview>('/api/admin/overview?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
      setOverview(data);
      setAuthState('ready');
    } catch (error) {
      const typed = error as Error & { status?: number; data?: ApiError };
      if (typed.status === 401) setAuthState('signin');
      else if (typed.status === 503 && typed.data?.error === 'admin_not_configured') setAuthState('unconfigured');
      else { setAuthState('error'); setNotice(typed.message); }
    }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const blockedSlotIds = useMemo(() => new Set(overview?.bookings.filter(booking => booking.status === 'pending' || booking.status === 'confirmed').map(booking => booking.slot_id) ?? []), [overview]);
  const visibleBookings = useMemo(() => overview?.bookings.filter(booking => filter === 'all' || booking.status === filter) ?? [], [overview, filter]);
  const upcomingSlots = useMemo(() => overview?.slots.filter(slot => slot.slot_date >= isoOffset(0)).slice(0, 80) ?? [], [overview]);
  const stats = useMemo(() => ({
    pending: overview?.bookings.filter(item => item.status === 'pending').length ?? 0,
    confirmed: overview?.bookings.filter(item => item.status === 'confirmed').length ?? 0,
    open: overview?.slots.filter(item => item.status === 'available' && !blockedSlotIds.has(item.id)).length ?? 0,
    holidays: overview?.blackouts.filter(item => item.type === 'holiday').length ?? 0,
  }), [overview, blockedSlotIds]);

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


  async function addSlots(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: slotDate, startTime: slotStart, endTime: slotEnd, durationMinutes: Number(slotDuration) }),
      });
      await refresh(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to add slots.');
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

  async function removeSlot(id: number) {
    if (!window.confirm('Remove this available slot?')) return;
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/api/admin/slots/' + id, { method: 'DELETE' });
      await refresh(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to remove slot.');
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
        <div><small>OPEN SLOTS</small><strong>{stats.open}</strong></div>
        <div><small>HOLIDAYS</small><strong>{stats.holidays}</strong></div>
      </div>

      <section className="admin-section" aria-labelledby="manage-bookings-title">
        <div className="admin-section-heading">
          <div><p className="eyebrow">BOOKING MANAGEMENT</p><h2 id="manage-bookings-title">Customer appointments</h2></div>
          <div className="admin-filters">
            <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
            <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
            <label>Status<select value={filter} onChange={event => setFilter(event.target.value as 'all' | BookingStatus)}><option value="all">All bookings</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <button className="button small" type="button" onClick={() => void refresh()}>Refresh</button>
          </div>
        </div>
        <div className="admin-bookings">
          {visibleBookings.length ? visibleBookings.map(booking => <BookingCard key={booking.id} booking={booking} slots={overview.slots} blockedSlotIds={blockedSlotIds} onChanged={message => void refresh(message)}/>) : <div className="admin-empty">No bookings match this date range and status.</div>}
        </div>
      </section>

      <section className="admin-section availability-manager" aria-labelledby="availability-title">
        <div className="admin-section-heading"><div><p className="eyebrow">AVAILABILITY</p><h2 id="availability-title">Open and close your diary</h2><p>Add a full day of appointment times, then remove individual slots whenever needed.</p></div></div>
        <div className="admin-tools-grid">
          <form className="admin-tool-card" onSubmit={addSlots}>
            <span className="tool-number">01</span><h3>Add available slots</h3><p>Create evenly spaced appointments for one day.</p>
            <div className="admin-form-grid">
              <label className="full">Date<input type="date" min={isoOffset(0)} required value={slotDate} onChange={event => setSlotDate(event.target.value)}/></label>
              <label>Start<input type="time" required value={slotStart} onChange={event => setSlotStart(event.target.value)}/></label>
              <label>Finish<input type="time" required value={slotEnd} onChange={event => setSlotEnd(event.target.value)}/></label>
              <label className="full">Appointment length<select value={slotDuration} onChange={event => setSlotDuration(event.target.value)}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></label>
            </div>
            <button className="button" type="submit" disabled={busy}>Add times</button>
          </form>

          <form className="admin-tool-card holiday-card" onSubmit={addBlackout}>
            <span className="tool-number">02</span><h3>Mark unavailable</h3><p>Close a few hours, a full day, or add a holiday date range.</p>
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
        <div className="admin-section-heading"><div><p className="eyebrow">DIARY CONTROL</p><h2 id="diary-title">Upcoming slots and closures</h2></div></div>
        <div className="admin-diary-grid">
          <div>
            <h3>Appointment slots</h3>
            <div className="admin-list">{upcomingSlots.length ? upcomingSlots.map(slot => <div className={'admin-list-row ' + slot.status} key={slot.id}><div><strong>{prettyDate(slot.slot_date)} · {slot.start_time}</strong><small>{slot.duration_minutes} min · {blockedSlotIds.has(slot.id) ? 'Booked' : slot.status === 'available' ? 'Open' : 'Unavailable'}</small></div><button type="button" disabled={busy || blockedSlotIds.has(slot.id)} onClick={() => void removeSlot(slot.id)}>{blockedSlotIds.has(slot.id) ? 'Booked' : 'Remove'}</button></div>) : <div className="admin-empty">No appointment slots in this date range.</div>}</div>
          </div>
          <div>
            <h3>Unavailable and holidays</h3>
            <div className="admin-list">{overview.blackouts.length ? overview.blackouts.map(item => <div className={'admin-list-row blackout ' + item.type} key={item.id}><div><span>{item.type === 'holiday' ? 'HOLIDAY' : 'NOT AVAILABLE'}</span><strong>{prettyDate(item.start_date)}{item.end_date !== item.start_date ? ' — ' + prettyDate(item.end_date) : ''}</strong><small>{item.start_time && item.end_time ? item.start_time + '–' + item.end_time : 'Full day'}{item.label ? ' · ' + item.label : ''}</small></div><button type="button" disabled={busy} onClick={() => void removeBlackout(item.id)}>Remove</button></div>) : <div className="admin-empty">No closures or holidays in this date range.</div>}</div>
          </div>
        </div>
      </section>
    </section>
  </main>;
}