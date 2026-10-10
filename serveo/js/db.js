// SERVEO — shared database helpers (Firestore)
// Use in a page:  <script type="module"> import { watchApproved } from './js/db.js'; ... </script>
import { db } from './firebase.js';
import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
const events = collection(db, 'events');
 
/* ---------- Safety: escape text before it is placed into HTML ---------- */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
 
// Returns a copy that is safe to put inside innerHTML templates
export function safeEvent(ev) {
  return {
    ...ev,
    id: ev.id,
    title: esc(ev.title),
    organizer: esc(ev.organizer),
    city: esc(ev.city),
    address: esc(ev.address),
    description: esc(ev.description),
    lat: Number(ev.lat), lng: Number(ev.lng),
    volunteersNeeded: Math.max(1, Number(ev.volunteersNeeded) || 1),
    volunteersJoined: Math.max(0, Number(ev.volunteersJoined) || 0),
    tags: (Array.isArray(ev.tags) ? ev.tags : []).map(esc),
    urgency: ['critical', 'live', 'ending', 'upcoming'].includes(ev.urgency) ? ev.urgency : 'upcoming',
    verified: ev.verified === true,
    // raw values the page may need for links (validated by the page)
    donationLink: ev.donationLink || null,
  };
}
 
function toEvent(d) {
  const data = d.data();
  return { ...data, id: data.id ?? d.id, _docId: d.id };
}
 
/* ---------- Reading ---------- */
// Live list of APPROVED events
export function watchApproved(onData, onError) {
  const q = query(events, where('status', '==', 'approved'));
  return onSnapshot(q, snap => onData(snap.docs.map(toEvent)), onError);
}
 
// One approved event by id (null if missing / not approved)
export async function getApprovedEvent(id) {
  const snap = await getDoc(doc(db, 'events', String(id)));
  if (!snap.exists()) return null;
  const ev = toEvent(snap);
  return ev.status === 'approved' ? ev : null;
}
 
// Live list of events waiting for approval (organizer dashboard)
export function watchPending(onData, onError) {
  const q = query(events, where('status', '==', 'pending'));
  return onSnapshot(q, snap => onData(snap.docs.map(toEvent)), onError);
}
 
export async function getContact(id) {
  try {
    const snap = await getDoc(doc(db, 'eventContacts', String(id)));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
 
/* ---------- Writing ---------- */
// Saves a new event as "pending". Contact details go in a separate collection.
export async function addEvent(eventData, contactData) {
  const ref = await addDoc(events, {
    ...eventData,
    status: 'pending',
    verified: false,
    urgency: 'upcoming',
    volunteersJoined: 0,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'eventContacts', ref.id), { ...contactData, createdAt: serverTimestamp() });
  return ref.id;
}
 
export function joinEvent(id) {
  return updateDoc(doc(db, 'events', String(id)), { volunteersJoined: increment(1) });
}
 
export function setEventStatus(id, patch) {
  return updateDoc(doc(db, 'events', String(id)), patch);
}
 
export function removeEvent(id) {
  return deleteDoc(doc(db, 'events', String(id)));
}