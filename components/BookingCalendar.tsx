import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { categories } from '../lib/services';

type PublicSlot = { id: string; date: string; time: string; durationMinutes: number };
type PublicBlackout = { startDate: string; endDate: string; startTime: string | null; endTime: string | null; type: 'unavailable' | 'holiday'; label: string | null };
type Availability = { month: string; treatment?: string; durationMinutes?: number; openingHours?: { days: string; opens: string; closes: string }; timezone: string; slots: PublicSlot[]; blackouts: PublicBlackout[] };
type Confirmation = { reference: string; date: string; time: string; durationMinutes: number; treatment: string; status: string };

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoDate(date: Date) {
  const year = date.getFullYear();
  return String(year) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function currentMonthValue() {
  return isoDate(new Date()).slice(0, 7);
}

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, value - 1, 1));
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function longDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'));
}

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function buildCalendar(month: string) {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(year, value - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, value - 1, 1 - offset);
  const today = isoDate(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = isoDate(date);
    return { iso, day: date.getDate(), current: date.getMonth() === value - 1, past: iso < today };
  });
}

export default function BookingCalendar() {
  const [month, setMonth] = useState(currentMonthValue);
  const [availability, setAvailability] = useState<Availability>({ month: currentMonthValue(), timezone: 'Europe/London', slots: [], blackouts: [] });
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarError, setCalendarError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [treatment, setTreatment] = useState('');
  const selectedTreatment = useMemo(() => categories.flatMap(category => category.treatments).find(item => item.name === treatment), [treatment]);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, PublicSlot[]>();
    for (const slot of availability.slots) grouped.set(slot.date, [...(grouped.get(slot.date) ?? []), slot]);
    return grouped;
  }, [availability.slots]);

  const days = useMemo(() => buildCalendar(month), [month]);
  const daySlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];
  const chosenSlot = availability.slots.find(slot => slot.id === selectedSlot);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('service');
    if (requested && categories.some(category => category.treatments.some(item => item.name === requested))) setTreatment(requested);
  }, []);

  useEffect(() => {
    if (!treatment) {
      setAvailability({ month, timezone: 'Europe/London', slots: [], blackouts: [] });
      setSelectedDate('');
      setSelectedSlot(null);
      setLoading(false);
      setCalendarError('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setCalendarError('');
    fetch('/api/availability?month=' + encodeURIComponent(month) + '&treatment=' + encodeURIComponent(treatment), { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as Availability & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to load availability.');
        setAvailability(data);
        setSelectedDate(current => data.slots.some(slot => slot.date === current) ? current : data.slots[0]?.date ?? '');
        setSelectedSlot(null);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setCalendarError(error instanceof Error ? error.message : 'Unable to load availability.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [month, treatment]);

  const blackoutForDay = (date: string) => availability.blackouts.find(item => date >= item.startDate && date <= item.endDate && !item.startTime);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      setFormError('Choose an available time first.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot,
          customerName: form.get('customerName'),
          phone: form.get('phone'),
          email: form.get('email'),
          treatment: form.get('treatment'),
          customerNotes: form.get('customerNotes'),
          consent: form.get('consent') === 'yes',
          website: form.get('website'),
        }),
      });
      const data = await response.json() as { booking?: Confirmation; error?: string };
      if (!response.ok || !data.booking) throw new Error(data.error || 'Unable to request this appointment.');
      setConfirmation(data.booking);
      const bookedStart = timeToMinutes(data.booking.time);
      const bookedEnd = bookedStart + data.booking.durationMinutes;
      setAvailability(current => ({ ...current, slots: current.slots.filter(slot => {
        if (slot.date !== data.booking?.date) return true;
        const start = timeToMinutes(slot.time);
        return start >= bookedEnd || start + slot.durationMinutes <= bookedStart;
      }) }));
      event.currentTarget.reset();
      setTreatment('');
      setSelectedSlot(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to request this appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) return <section className="booking-section" id="booking" aria-labelledby="booking-title">
    <div className="section booking-confirmation">
      <span className="confirmation-mark" aria-hidden="true">✓</span>
      <p className="eyebrow">BOOKING REQUEST RECEIVED</p>
      <h2 id="booking-title">Thank you.<br/><em>We’ll be in touch.</em></h2>
      <p>Your request for <strong>{confirmation.treatment}</strong> is saved for <strong>{longDate(confirmation.date)} at {confirmation.time}</strong>.</p>
      <div className="confirmation-reference"><small>YOUR REFERENCE</small><strong>{confirmation.reference}</strong></div>
      <p className="booking-small">Your appointment is pending until the salon confirms it with you. Please keep your reference.</p>
      <button className="button" type="button" onClick={() => setConfirmation(null)}>Book another appointment</button>
    </div>
  </section>;

  return <section className="booking-section" id="booking" aria-labelledby="booking-title">
    <div className="section">
      <div className="booking-heading">
        <div>
          <p className="eyebrow">ONLINE APPOINTMENTS</p>
          <h2 id="booking-title">Choose your day.<br/><em>Make it yours.</em></h2>
        </div>
        <p>Choose your treatment first, then view times that fit its appointment length. The salon is available Monday to Sunday, 10:00–22:00.</p>
      </div>

      <div className="booking-treatment-picker">
        <div><p className="eyebrow">STEP 1 · CHOOSE A TREATMENT</p><h3>What would you like to book?</h3></div>
        <label>
          <span>Treatment</span>
          <select required value={treatment} onChange={event => { setTreatment(event.target.value); setSelectedSlot(null); }}>
            <option value="">Choose a treatment</option>
            {categories.map(category => <optgroup label={category.name} key={category.slug}>{category.treatments.map(item => <option key={item.name} value={item.name}>{item.name} · £{item.price} · {item.durationMinutes} min</option>)}</optgroup>)}
          </select>
        </label>
        <p>{selectedTreatment ? selectedTreatment.durationMinutes + ' minute appointment · available daily from 10:00 to 22:00' : 'Select a treatment to open the live calendar.'}</p>
      </div>

      <div className="booking-shell">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <button type="button" aria-label="Previous month" disabled={month <= currentMonthValue()} onClick={() => setMonth(value => shiftMonth(value, -1))}>←</button>
            <h3>{monthLabel(month)}</h3>
            <button type="button" aria-label="Next month" onClick={() => setMonth(value => shiftMonth(value, 1))}>→</button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" aria-label={'Appointment calendar for ' + monthLabel(month)}>
            {days.map(day => {
              const slots = slotsByDate.get(day.iso) ?? [];
              const blackout = blackoutForDay(day.iso);
              const disabled = !day.current || day.past || slots.length === 0;
              return <button
                type="button"
                key={day.iso}
                className={[
                  'calendar-day',
                  !day.current ? 'outside' : '',
                  day.past ? 'past' : '',
                  slots.length ? 'has-slots' : '',
                  selectedDate === day.iso ? 'selected' : '',
                  blackout ? 'blocked' : '',
                ].filter(Boolean).join(' ')}
                disabled={disabled}
                onClick={() => { setSelectedDate(day.iso); setSelectedSlot(null); }}
                aria-label={day.iso + (slots.length ? ', ' + slots.length + ' times available' : ', unavailable')}
                title={blackout?.label || (blackout?.type === 'holiday' ? 'Salon holiday' : '')}
              >
                <span>{day.day}</span>
                {slots.length > 0 && <small>{slots.length} {slots.length === 1 ? 'time' : 'times'}</small>}
                {blackout && day.current && <small>{blackout.type === 'holiday' ? 'Holiday' : 'Closed'}</small>}
              </button>;
            })}
          </div>
          <div className="calendar-legend"><span><i/>Available</span><span><i/>Selected</span><span><i/>Unavailable</span></div>
          {loading && treatment && <p className="calendar-status" role="status">Loading live availability…</p>}
          {calendarError && <p className="calendar-status error" role="alert">{calendarError}</p>}
          {!treatment && <p className="calendar-status">Choose a treatment above to see available dates and times.</p>}
          {treatment && !loading && !calendarError && availability.slots.length === 0 && <p className="calendar-status">No times are available for this treatment this month. Please try another month or contact the salon.</p>}
        </div>

        <div className="time-panel">
          <p className="eyebrow">STEP 2 · CHOOSE A TIME</p>
          <h3>{selectedDate ? longDate(selectedDate) : 'Select an available day'}</h3>
          {selectedDate && daySlots.length > 0 ? <div className="time-grid" role="group" aria-label="Available appointment times">
            {daySlots.map(slot => <button type="button" className={selectedSlot === slot.id ? 'time-slot selected' : 'time-slot'} key={slot.id} onClick={() => setSelectedSlot(slot.id)}>
              <strong>{slot.time}</strong><small>{slot.durationMinutes} min</small>
            </button>)}
          </div> : <p className="time-empty">Available times will appear here after you choose a highlighted date.</p>}
          <div className="booking-promise"><span aria-hidden="true">♡</span><p><strong>Your time is held when the request is submitted.</strong><br/>The salon will contact you to confirm the appointment.</p></div>
        </div>
      </div>

      <form className="booking-form" onSubmit={submit}>
        <div className="booking-form-heading">
          <div><p className="eyebrow">STEP 3 · YOUR DETAILS</p><h3>Complete your request</h3></div>
          <p>{chosenSlot ? longDate(chosenSlot.date) + ' · ' + chosenSlot.time : 'Choose a date and time above'}</p>
        </div>
        <div className="booking-form-grid">
          <label>Your name <span>*</span><input name="customerName" required maxLength={80} autoComplete="name"/></label>
          <label>Phone number <span>*</span><input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" placeholder="+44"/></label>
          <label>Email <small>optional</small><input name="email" type="email" maxLength={120} autoComplete="email"/></label>
          <div className="booking-treatment-summary"><small>TREATMENT</small><strong>{selectedTreatment?.name || 'Choose a treatment above'}</strong><span>{selectedTreatment ? selectedTreatment.durationMinutes + ' min' : ''}</span><input type="hidden" name="treatment" value={treatment}/></div>
          <label className="full">Anything we should know? <small>optional — do not include medical details</small><textarea name="customerNotes" rows={4} maxLength={500} placeholder="A short appointment note"/></label>
          <label className="booking-consent full"><input type="checkbox" name="consent" value="yes" required/><span>I agree that my details can be stored and used to arrange this appointment. <a href="#privacy">Read privacy information.</a></span></label>
          <label className="booking-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        </div>
        {formError && <p className="booking-form-error" role="alert">{formError}</p>}
        <button className="button booking-submit" type="submit" disabled={!selectedSlot || submitting}>{submitting ? 'Saving your request…' : 'Request appointment'} <span aria-hidden="true">→</span></button>
        <p className="booking-small">This sends a booking request. Your appointment is confirmed only after the salon contacts you.</p>
      </form>
    </div>
  </section>;
}