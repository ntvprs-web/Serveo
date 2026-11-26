import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../utils/constants';
import EventCard from '../components/EventCard';

export default function EventsPage() {
  const { events, eventsLoading, savedIds } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState('soonest'); // 'soonest' | 'nearest' | 'needed' | 'saved'

  const handleCategoryChange = (catKey) => {
    setSelectedCategory(catKey);
    const next = new URLSearchParams(searchParams);
    if (catKey === 'all') next.delete('category');
    else next.set('category', catKey);
    setSearchParams(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = events.filter((ev) => {
      if (selectedCategory !== 'all' && ev.category !== selectedCategory) return false;
      if (sortBy === 'saved' && !savedIds.includes(String(ev.id))) return false;
      if (!q) return true;
      return (
        ev.title?.toLowerCase().includes(q) ||
        ev.city?.toLowerCase().includes(q) ||
        ev.organizer?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'nearest') {
      list.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    } else if (sortBy === 'needed') {
      list.sort(
        (a, b) =>
          (b.volunteersNeeded - b.volunteersJoined) - (a.volunteersNeeded - a.volunteersJoined)
      );
    } else {
      list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    }
    return list;
  }, [events, query, selectedCategory, sortBy, savedIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Discover <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Events</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Browse {filtered.length} verified public-service events & volunteer drives
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={16} color="var(--text-muted)" />
          <select
            className="select-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '8px 14px', borderRadius: 99 }}
          >
            <option value="soonest">Sort: Soonest</option>
            <option value="nearest">Sort: Nearest</option>
            <option value="needed">Sort: Most Volunteers Needed</option>
            <option value="saved">Filter: Saved Only</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={18}
          color="var(--text-muted)"
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="input-field"
          placeholder="Search by event name, city, NGO, or cause..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 44, borderRadius: 18 }}
        />
      </div>

      {/* Category Chips */}
      <div className="h-scroll">
        <button
          type="button"
          onClick={() => handleCategoryChange('all')}
          className="pill-btn"
          style={{
            flexShrink: 0,
            background: selectedCategory === 'all' ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
            color: selectedCategory === 'all' ? 'var(--text-inverse)' : 'var(--text-primary)'
          }}
        >
          All Categories
        </button>
        {Object.values(CATEGORIES).map((cat) => {
          const active = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategoryChange(cat.key)}
              className="pill-btn"
              style={{
                flexShrink: 0,
                background: active ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
                color: active ? 'var(--text-inverse)' : 'var(--text-primary)'
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {eventsLoading ? (
        <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading events...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
          No matching events found. Try clearing your filters.
        </div>
      ) : (
        <div className="grid-responsive-3">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
