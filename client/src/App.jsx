import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppShell from './components/AppShell';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import MapPage from './pages/MapPage';
import EventDetailPage from './pages/EventDetailPage';
import PostEventPage from './pages/PostEventPage';
import LoginPage from './pages/LoginPage';
import BloodDonationPage from './pages/BloodDonationPage';
import UrgentBloodPage from './pages/UrgentBloodPage';
import FoodDonationPage from './pages/FoodDonationPage';
import OrganizerPage from './pages/OrganizerPage';
import MyHoursPage from './pages/MyHoursPage';
import BadgesShopPage from './pages/BadgesShopPage';
import ImpactPage from './pages/ImpactPage';
import PremiumPage from './pages/PremiumPage';
import { AboutPage, LegalPage } from './pages/StaticInfoPages';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events.html" element={<Navigate to="/events" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/map.html" element={<Navigate to="/map" replace />} />
            <Route path="/event/:id" element={<EventDetailPage />} />
            <Route path="/event-detail/:id" element={<EventDetailPage />} />
            <Route path="/events-detail/:id" element={<EventDetailPage />} />
            <Route path="/post-event" element={<PostEventPage />} />
            <Route path="/post-event.html" element={<Navigate to="/post-event" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login.html" element={<Navigate to="/login" replace />} />
            <Route path="/organization-login" element={<LoginPage />} />
            <Route path="/organizer-login" element={<LoginPage />} />
            <Route path="/blood-donation" element={<BloodDonationPage />} />
            <Route path="/blood-donation.html" element={<Navigate to="/blood-donation" replace />} />
            <Route path="/urgent-blood" element={<UrgentBloodPage />} />
            <Route path="/urgent-blood.html" element={<Navigate to="/urgent-blood" replace />} />
            <Route path="/food-donation" element={<FoodDonationPage />} />
            <Route path="/food-donation.html" element={<Navigate to="/food-donation" replace />} />
            <Route path="/organizer" element={<OrganizerPage />} />
            <Route path="/organizer.html" element={<Navigate to="/organizer" replace />} />
            <Route path="/organization" element={<Navigate to="/organizer" replace />} />
            <Route path="/dashboard" element={<Navigate to="/organizer" replace />} />
            <Route path="/my-hours" element={<MyHoursPage />} />
            <Route path="/my-hours.html" element={<Navigate to="/my-hours" replace />} />
            <Route path="/badges" element={<BadgesShopPage />} />
            <Route path="/badges.html" element={<Navigate to="/badges" replace />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/premium.html" element={<Navigate to="/premium" replace />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="/impact.html" element={<Navigate to="/impact" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/about.html" element={<Navigate to="/about" replace />} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="/terms.html" element={<Navigate to="/terms" replace />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/privacy.html" element={<Navigate to="/privacy" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </BrowserRouter>
  );
}
