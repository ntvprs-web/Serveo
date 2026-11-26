import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Award, CalendarCheck, HeartPulse, LocateFixed, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

export default function BloodDonationPage() {
  const { user, userLocation, detectLocation, addToast } = useApp();
  const [stock, setStock] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [donations, setDonations] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [cooldownDays, setCooldownDays] = useState(90);

  // Donor volunteer opt-in & pre-screening fields
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || 'O+');
  const [age, setAge] = useState('25');
  const [weightKg, setWeightKg] = useState('60');
  const [city, setCity] = useState(user?.homeCity || userLocation?.city || 'New Delhi');
  const [phone, setPhone] = useState(user?.phone || '');
  const [availability, setAvailability] = useState('anytime');
  const [recentIllnessFree, setRecentIllnessFree] = useState(false);
  const [recentTattooFree, setRecentTattooFree] = useState(false);
  const [consentAlerts, setConsentAlerts] = useState(false);
  const [savingEligibility, setSavingEligibility] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    apiFetch('/api/blood-bank-stock').then((d) => setStock(d.stock || d || [])).catch(() => {});
    apiFetch('/api/donors/leaderboard').then((d) => setLeaderboard(d.leaderboard || d || [])).catch(() => {});
    if (user) {
      apiFetch('/api/donors/donations/mine').then((d) => setDonations(d.donations || d || [])).catch(() => {});
      apiFetch('/api/donors/eligibility-date').then((d) => {
        setEligibility(d);
        if (d.lastDonationDate) setLastDonationDate(d.lastDonationDate);
        if (d.cooldownDays) setCooldownDays(d.cooldownDays);
      }).catch(() => {});
      apiFetch('/api/donors/profile').then((d) => {
        if (d.profile) {
          setBloodGroup(d.profile.bloodGroup || user.bloodGroup || 'O+');
          if (d.profile.age) setAge(String(d.profile.age));
          if (d.profile.weightKg) setWeightKg(String(d.profile.weightKg));
          if (d.profile.city) setCity(d.profile.city);
          if (d.profile.phone) setPhone(d.profile.phone);
          if (d.profile.availability) setAvailability(d.profile.availability);
          setRecentIllnessFree(Boolean(d.profile.recentIllnessFree));
          setRecentTattooFree(Boolean(d.profile.recentTattooFree));
          setConsentAlerts(Boolean(d.profile.consentAlerts));
        }
      }).catch(() => {});
    }
  }, [user]);

  const handleSaveEligibility = async (e) => {
    e.preventDefault();
    setSavingEligibility(true);
    try {
      const res = await apiFetch('/api/donors/eligibility-date', {
        method: 'PUT',
        body: JSON.stringify({ lastDonationDate, cooldownDays: Number(cooldownDays) })
      });
      setEligibility(res);
      addToast('Donation eligibility date updated!');
    } catch (err) {
      addToast(err.message || 'Could not update eligibility');
    } finally {
      setSavingEligibility(false);
    }
  };

  const handleUpdateDonorProfile = async (e) => {
    e.preventDefault();
    if (!recentIllnessFree || !recentTattooFree || !consentAlerts) {
      addToast('Please confirm all health pre-screening and alert consent checkboxes.');
      return;
    }
    setSavingProfile(true);
    try {
      await apiFetch('/api/donors/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bloodGroup,
          age: Number(age),
          weightKg: Number(weightKg),
          city: city.trim(),
          lat: userLocation?.lat ?? null,
          lng: userLocation?.lng ?? null,
          phone: phone.trim(),
          availability,
          recentIllnessFree,
          recentTattooFree,
          consentAlerts,
          availableForUrgent: true
        })
      });
      addToast(`Blood donor volunteer profile saved (${bloodGroup})!`);
    } catch (err) {
      addToast(err.message || 'Could not update donor profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Blood Donation <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Center</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Track 90-day donor eligibility, view blood bank needs, and download verified certificates.
          </p>
        </div>
        <Link to="/urgent-blood" className="pill-btn pill-btn-coral">
          <HeartPulse size={16} /> Urgent Blood Requests
        </Link>
      </div>

      {/* Donor Eligibility & Profile */}
      <div className="grid-responsive-2">
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={18} color="#EF4444" /> 90-Day Donor Eligibility
          </h3>
          {!user ? (
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              <Link to="/login" style={{ textDecoration: 'underline', fontWeight: 700 }}>Sign in</Link> to track your personal donation eligibility and certificates.
            </p>
          ) : (
            <form onSubmit={handleSaveEligibility} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Last Blood Donation Date</label>
                <input
                  type="date"
                  required
                  className="input-field"
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Recovery Cooldown Period</label>
                <select className="select-field" value={cooldownDays} onChange={(e) => setCooldownDays(Number(e.target.value))}>
                  <option value={90}>90 Days (Standard / Male)</option>
                  <option value={120}>120 Days (Female)</option>
                </select>
              </div>
              <button type="submit" disabled={savingEligibility} className="pill-btn pill-btn-dark">
                {savingEligibility ? 'Checking...' : 'Check & Save Eligibility'}
              </button>
              {eligibility && (
                <div style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)', fontSize: '0.84rem' }}>
                  Next eligible date: <strong>{eligibility.eligibleNow ? 'Eligible now' : (eligibility.nextEligibleDate || 'Eligible now')}</strong>
                  {!eligibility.eligibleNow && eligibility.nextEligibleDate ? ` (Cooling down until ${eligibility.nextEligibleDate})` : ''}
                </div>
              )}
            </form>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Droplets size={18} color="#EF4444" /> Blood Donor Volunteer Opt-In
            </h3>
            <button type="button" onClick={detectLocation} className="pill-btn" style={{ padding: '6px 10px', fontSize: '0.76rem' }}>
              <LocateFixed size={13} /> {userLocation ? 'GPS Ready' : 'Detect GPS'}
            </button>
          </div>
          {!user ? (
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              <Link to="/login" style={{ textDecoration: 'underline', fontWeight: 700 }}>Sign in</Link> to complete donor pre-screening and opt in for urgent blood alerts.
            </p>
          ) : (
            <form onSubmit={handleUpdateDonorProfile} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="grid-responsive-3">
                <div>
                  <label className="form-label">Blood Group</label>
                  <select className="select-field" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Age (18–65)</label>
                  <input type="number" min={18} max={65} required className="input-field" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Weight (kg, min 45)</label>
                  <input type="number" min={45} max={250} required className="input-field" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
              </div>

              <div className="grid-responsive-3">
                <div>
                  <label className="form-label">City</label>
                  <input type="text" required className="input-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New Delhi" />
                </div>
                <div>
                  <label className="form-label">Contact Phone</label>
                  <input type="tel" required className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="form-label">Availability</label>
                  <select className="select-field" value={availability} onChange={(e) => setAvailability(e.target.value)}>
                    <option value="anytime">Anytime</option>
                    <option value="emergencies_only">Emergencies Only</option>
                    <option value="weekends">Weekends</option>
                    <option value="weekdays">Weekdays</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} color="#10B981" /> Pre-Donation Volunteer Screening
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={recentIllnessFree} onChange={(e) => setRecentIllnessFree(e.target.checked)} />
                  <span>I have not had fever, active infection, or antibiotics in the last 14 days.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={recentTattooFree} onChange={(e) => setRecentTattooFree(e.target.checked)} />
                  <span>I have not had a tattoo, piercing, or major surgery in the last 6 months.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={consentAlerts} onChange={(e) => setConsentAlerts(e.target.checked)} />
                  <span>I consent to receive nearby urgent blood alerts and share my contact when I accept a request.</span>
                </label>
              </div>

              <button type="submit" disabled={savingProfile} className="pill-btn pill-btn-gold">
                {savingProfile ? 'Saving Donor Profile...' : 'Complete Screening & Opt In as Blood Donor'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Blood Bank Stock */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 12px' }}>Regional Blood Bank Stock</h3>
        {Array.isArray(stock) && stock.length > 0 ? (
          <div className="grid-responsive-3">
            {stock.slice(0, 6).map((s, i) => (
              <div key={s.id || i} style={{ padding: 14, borderRadius: 16, background: 'var(--bg-surface-muted)' }}>
                <div style={{ fontWeight: 700 }}>{s.bloodBankName || s.city || 'Regional Blood Bank'}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Group: <strong>{s.bloodGroup}</strong> · Units: <strong>{s.unitsAvailable ?? s.units ?? 'Low'}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Blood bank stock updates appear here as regional hospitals publish inventory.
          </p>
        )}
      </div>

      {/* Certificates & Leaderboard */}
      <div className="grid-responsive-2">
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="#F59E0B" /> My Donation Certificates
          </h3>
          {donations.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Confirmed blood donations generate verifiable PDF certificates here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {donations.map((d) => (
                <div key={d.id} style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{d.bloodBank || 'Verified Camp'}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{d.donatedAt || d.date}</div>
                  </div>
                  <a href={`/api/donor-certificates/${d.id}.pdf`} target="_blank" rel="noreferrer" className="pill-btn">
                    PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Top Community Donors</h3>
          {Array.isArray(leaderboard) && leaderboard.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <div key={entry.userId || idx} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--bg-surface-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>#{idx + 1} {entry.name || 'Donor'}</span>
                  <span style={{ fontWeight: 700, color: '#EF4444' }}>{entry.donationsCount || entry.count || 1} units</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Leaderboard populates as donors complete verified donations.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
