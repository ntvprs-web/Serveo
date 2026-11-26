#!/usr/bin/env node
/**
 * seed-demo-events.js
 * -------------------
 * Run once to insert 50 varied demo events across India into the Supabase DB.
 * Usage:  node backend/seed-demo-events.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('❌ DATABASE_URL not set in .env'); process.exit(1); }

const isRemote = /supabase|pooler/i.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15000,
  ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
});

// ---------- helpers ----------
const today = new Date();
function futureDate(daysFromNow) {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

// ---------- 50 demo events spread across India ----------
const EVENTS = [
  // ===== BLOOD =====
  { id:'demo_ev_01', title:'Emergency Blood Donation Camp', category:'blood', organizer:'Indian Red Cross Society', city:'New Delhi', state:'Delhi', address:'Red Cross Bhawan, Parliament Street, New Delhi', lat:28.6270, lng:77.2140, date:futureDate(1), startTime:'09:00', endTime:'17:00', volunteersNeeded:200, volunteersJoined:87, urgency:'live', description:'Delhi faces a critical shortage of O-negative and B-negative blood. Walk-ins welcome; every unit saves up to three lives.', donationLink:'upi://pay?pa=indianredcross@sbi', tags:['blood','emergency','urgent'] },
  { id:'demo_ev_02', title:'Community Blood Donation Mega Camp', category:'blood', organizer:'Rotary Club Bengaluru', city:'Bengaluru', state:'Karnataka', address:'Rotary Bhavan, Indiranagar, Bengaluru', lat:12.9719, lng:77.6412, date:futureDate(3), startTime:'09:00', endTime:'18:00', volunteersNeeded:250, volunteersJoined:90, urgency:'upcoming', description:'Quarterly mega blood camp partnered with three regional blood banks. All blood groups needed.', tags:['blood','mega camp'] },
  { id:'demo_ev_03', title:'Corporate Blood Donation Drive', category:'blood', organizer:'Lions Club Hyderabad', city:'Hyderabad', state:'Telangana', address:'HITEC City Convention Centre, Hyderabad', lat:17.4435, lng:78.3772, date:futureDate(2), startTime:'09:30', endTime:'16:30', volunteersNeeded:150, volunteersJoined:140, urgency:'ending', description:'IT-corridor drive in partnership with tech companies. Almost at capacity — a few slots left.', tags:['blood','corporate'] },
  { id:'demo_ev_04', title:'Emergency O- & AB- Blood Drive', category:'blood', organizer:'Visakhapatnam Voluntary Donors', city:'Visakhapatnam', state:'Andhra Pradesh', address:'King George Hospital Blood Wing, Visakhapatnam', lat:17.7042, lng:83.3065, date:futureDate(1), startTime:'08:30', endTime:'16:00', volunteersNeeded:100, volunteersJoined:68, urgency:'critical', description:'Urgent coastal blood drive supporting thalassemia patients and trauma care units.', tags:['blood','emergency'] },
  { id:'demo_ev_05', title:'Thalassemia Awareness Blood Camp', category:'blood', organizer:'Thalassemia Sickle Cell Society Rajkot', city:'Rajkot', state:'Gujarat', address:'Race Course Ground, Rajkot', lat:22.2969, lng:70.7986, date:futureDate(5), startTime:'08:00', endTime:'15:00', volunteersNeeded:120, volunteersJoined:34, urgency:'upcoming', description:'Raising awareness for thalassemia patients who require regular transfusions. All blood groups welcome.', tags:['blood','thalassemia','awareness'] },

  // ===== MEDICAL =====
  { id:'demo_ev_06', title:'Free Medical Health Screening', category:'medical', organizer:'Indian Red Cross Society', city:'New Delhi', state:'Delhi', address:'Community Health Centre, Karol Bagh, New Delhi', lat:28.6519, lng:77.1909, date:futureDate(2), startTime:'10:00', endTime:'16:00', volunteersNeeded:50, volunteersJoined:32, urgency:'upcoming', description:'Free BP, sugar, and basic diagnostics for underserved families. Doctors and lab technicians on-site.', tags:['medical','free','screening'] },
  { id:'demo_ev_07', title:'Free Eye Checkup Camp', category:'medical', organizer:'Aravind Eye Care Trust', city:'Madurai', state:'Tamil Nadu', address:'Aravind Eye Hospital Outreach Wing, Madurai', lat:9.9195, lng:78.1194, date:futureDate(1), startTime:'08:30', endTime:'13:30', volunteersNeeded:60, volunteersJoined:42, urgency:'live', description:'Free vision screening, cataract detection, and spectacles distribution for elderly and low-income patients.', donationLink:'upi://pay?pa=aravindeye@sbi', tags:['medical','eyecare'] },
  { id:'demo_ev_08', title:'Free Dental Camp', category:'medical', organizer:'Smile Foundation', city:'Jaipur', state:'Rajasthan', address:'Smile Foundation Clinic, Malviya Nagar, Jaipur', lat:26.8535, lng:75.8039, date:futureDate(1), startTime:'10:00', endTime:'15:00', volunteersNeeded:40, volunteersJoined:38, urgency:'ending', description:'Free dental checkups, cleaning, and extractions for underserved communities.', donationLink:'upi://pay?pa=smilefoundation@icici', tags:['medical','dental'] },
  { id:'demo_ev_09', title:'Free Pediatric & Maternal Nutrition Camp', category:'medical', organizer:'Jan Swasthya Indore', city:'Indore', state:'Madhya Pradesh', address:'Rajwada Civic Dispensary, Indore', lat:22.7186, lng:75.8557, date:futureDate(4), startTime:'09:00', endTime:'14:00', volunteersNeeded:45, volunteersJoined:29, urgency:'upcoming', description:'Pediatricians and nutritionists offering free checkups, iron supplements, and growth monitoring.', tags:['medical','pediatric','nutrition'] },
  { id:'demo_ev_10', title:'TB Awareness & Free Screening Drive', category:'medical', organizer:'Revised National TB Control Programme Varanasi', city:'Varanasi', state:'Uttar Pradesh', address:'Banaras Hindu University Health Centre, Varanasi', lat:25.2677, lng:82.9913, date:futureDate(6), startTime:'09:00', endTime:'14:00', volunteersNeeded:70, volunteersJoined:22, urgency:'upcoming', description:'Free sputum testing and chest X-ray camp with DOTS counseling for high-risk communities.', tags:['medical','TB','awareness'] },

  // ===== FOOD =====
  { id:'demo_ev_11', title:'Community Food Distribution Drive', category:'food', organizer:'Akshaya Patra Foundation', city:'Mumbai', state:'Maharashtra', address:'Dharavi Community Hall, Mumbai', lat:19.0410, lng:72.8570, date:futureDate(1), startTime:'12:00', endTime:'15:00', volunteersNeeded:150, volunteersJoined:120, urgency:'live', description:'Hot, nutritious meals for daily-wage families and children. Volunteers help pack, serve, and coordinate queues.', donationLink:'upi://pay?pa=akshayapatra@icici', tags:['food','meals','children'] },
  { id:'demo_ev_12', title:'Meals for Migrant Workers', category:'food', organizer:'Robin Hood Army Kolkata', city:'Kolkata', state:'West Bengal', address:'Howrah Railway Station Relief Point, Kolkata', lat:22.5839, lng:88.3428, date:futureDate(1), startTime:'19:00', endTime:'22:00', volunteersNeeded:500, volunteersJoined:300, urgency:'critical', description:'Surplus-food rescue and distribution to migrant workers and homeless families near the station.', donationLink:'upi://pay?pa=robinhoodarmy@ybl', tags:['food','urgent','night shift'] },
  { id:'demo_ev_13', title:'Langar & Community Kitchen Seva', category:'food', organizer:'Khalsa Aid Punjab Chapter', city:'Amritsar', state:'Punjab', address:'Hall Gate Community Kitchen, Amritsar', lat:31.6285, lng:74.8723, date:futureDate(1), startTime:'11:30', endTime:'15:30', volunteersNeeded:200, volunteersJoined:155, urgency:'live', description:'Daily community meal preparation and distribution serving fresh vegetarian meals to travelers and daily-wage workers.', donationLink:'upi://pay?pa=khalsaaid@hdfc', tags:['food','seva','meals'] },
  { id:'demo_ev_14', title:'Mid-Day Meal Volunteer Support', category:'food', organizer:'Annamrita ISKCON Ahmedabad', city:'Ahmedabad', state:'Gujarat', address:'ISKCON Kitchen, Satellite Road, Ahmedabad', lat:23.0276, lng:72.5571, date:futureDate(3), startTime:'08:00', endTime:'13:00', volunteersNeeded:80, volunteersJoined:55, urgency:'upcoming', description:'Volunteers assist the mid-day meal program serving 25,000 school children daily. Packing and logistics help needed.', tags:['food','children','education'] },
  { id:'demo_ev_15', title:'Tribal Village Nutrition Drive', category:'food', organizer:'ASHA Workers Collective Ranchi', city:'Ranchi', state:'Jharkhand', address:'District Hospital Outreach, Kanke Road, Ranchi', lat:23.3700, lng:85.3250, date:futureDate(7), startTime:'07:00', endTime:'12:00', volunteersNeeded:60, volunteersJoined:18, urgency:'upcoming', description:'Distributing iron-fortified rations, ORS packets, and nutrition kits to Munda and Oraon tribal hamlets.', tags:['food','tribal','nutrition'] },

  // ===== DISASTER =====
  { id:'demo_ev_16', title:'Flood Relief Camp', category:'disaster', organizer:'NDRF Community Wing', city:'Patna', state:'Bihar', address:'Gandhi Maidan Relief Center, Patna', lat:25.6127, lng:85.1447, date:futureDate(1), startTime:'08:00', endTime:'20:00', volunteersNeeded:100, volunteersJoined:45, urgency:'critical', description:'Displaced families need dry rations, clean drinking water, and temporary shelter kits after heavy monsoon flooding.', donationLink:'upi://pay?pa=ndrfrelief@sbi', tags:['disaster','flood','urgent'] },
  { id:'demo_ev_17', title:'Disaster Relief Supply Drive', category:'disaster', organizer:'SEEDS India', city:'Bhopal', state:'Madhya Pradesh', address:'SEEDS Regional Office, Arera Colony, Bhopal', lat:23.2276, lng:77.4413, date:futureDate(1), startTime:'09:00', endTime:'17:00', volunteersNeeded:120, volunteersJoined:55, urgency:'critical', description:'Packing and dispatch of emergency relief kits — food, water purification tablets, and first-aid — for cyclone-affected coastal districts.', donationLink:'upi://pay?pa=seedsindia@icici', tags:['disaster','relief kits'] },
  { id:'demo_ev_18', title:'Brahmaputra Flood Relief Boat Dispatch', category:'disaster', organizer:'Assam Relief Collective', city:'Guwahati', state:'Assam', address:'Fancy Bazar Relief Ghat, Guwahati', lat:26.1869, lng:91.7375, date:futureDate(1), startTime:'07:30', endTime:'18:00', volunteersNeeded:110, volunteersJoined:74, urgency:'critical', description:'Urgent packing of tarpaulins, ORS packets, mosquito nets, and dry rations for riverine relief camps.', donationLink:'upi://pay?pa=assamrelief@sbi', tags:['disaster','flood','urgent'] },
  { id:'demo_ev_19', title:'Clothes & Blanket Collection', category:'disaster', organizer:'HelpAge India', city:'New Delhi', state:'Delhi', address:'Community Centre, Lajpat Nagar, New Delhi', lat:28.5677, lng:77.2434, date:futureDate(1), startTime:'10:00', endTime:'18:00', volunteersNeeded:40, volunteersJoined:28, urgency:'live', description:'Winter clothing and blanket collection for elderly and homeless residents ahead of the cold season.', donationLink:'upi://pay?pa=helpageindia@sbi', tags:['disaster','winter relief'] },
  { id:'demo_ev_20', title:'Cyclone Shelter Preparedness Drill', category:'disaster', organizer:'Odisha State Disaster Management Authority', city:'Bhubaneswar', state:'Odisha', address:'Kalinga Stadium Relief Camp, Bhubaneswar', lat:20.2855, lng:85.8198, date:futureDate(4), startTime:'06:00', endTime:'14:00', volunteersNeeded:200, volunteersJoined:90, urgency:'upcoming', description:'Mock cyclone drill — practice evacuation routes, shelter setup, and first-aid triage for coastal volunteers.', tags:['disaster','cyclone','drill'] },

  // ===== ENVIRONMENT =====
  { id:'demo_ev_21', title:'Tree Plantation Marathon', category:'environment', organizer:'Uttarakhand Green Circle', city:'Dehradun', state:'Uttarakhand', address:'Rajaji National Park Buffer Zone, Dehradun', lat:30.3398, lng:78.0510, date:futureDate(3), startTime:'07:00', endTime:'11:00', volunteersNeeded:300, volunteersJoined:200, urgency:'upcoming', description:'Large-scale native-species plantation drive to restore the buffer forest. Saplings, tools, and refreshments provided.', tags:['environment','trees','plantation'] },
  { id:'demo_ev_22', title:'River Cleanup & Plastic Drive', category:'environment', organizer:'Cochin Nature Society', city:'Kochi', state:'Kerala', address:'Marine Drive Waterfront, Kochi', lat:9.9658, lng:76.2803, date:futureDate(5), startTime:'06:30', endTime:'09:30', volunteersNeeded:150, volunteersJoined:70, urgency:'upcoming', description:'Backwater clean-up and single-use plastic collection drive, followed by a segregation and recycling workshop.', tags:['environment','cleanup','plastic'] },
  { id:'demo_ev_23', title:'Sabarmati Riverfront Cleanliness & Composting', category:'environment', organizer:'Green Ahmedabad Initiative', city:'Ahmedabad', state:'Gujarat', address:'Sabarmati Riverfront Promenade, Paldi, Ahmedabad', lat:23.0145, lng:72.5714, date:futureDate(3), startTime:'06:30', endTime:'10:00', volunteersNeeded:140, volunteersJoined:95, urgency:'upcoming', description:'Morning riverfront cleanup, waste segregation, and community composting demonstration. Gloves and bags provided.', tags:['environment','cleanup'] },
  { id:'demo_ev_24', title:'Mangrove Restoration Drive', category:'environment', organizer:'Sundarbans Conservation Trust', city:'Kolkata', state:'West Bengal', address:'Godkhali Jetty, South 24 Parganas', lat:22.1166, lng:88.7638, date:futureDate(8), startTime:'06:00', endTime:'12:00', volunteersNeeded:100, volunteersJoined:35, urgency:'upcoming', description:'Planting mangrove saplings along eroded deltaic embankments. Boat transport and refreshments provided by the Trust.', tags:['environment','mangrove','conservation'] },
  { id:'demo_ev_25', title:'Himalayan Trail Cleanup Trek', category:'environment', organizer:'Waste Warriors Dharamsala', city:'Dharamsala', state:'Himachal Pradesh', address:'Bhagsu Nag Trailhead, McLeodganj', lat:32.2432, lng:76.3234, date:futureDate(6), startTime:'07:00', endTime:'13:00', volunteersNeeded:50, volunteersJoined:28, urgency:'upcoming', description:'Trek-and-clean drive along popular trekking routes. Carry your own water bottle; waste bags and gloves provided.', tags:['environment','trek','cleanup'] },

  // ===== ANIMAL =====
  { id:'demo_ev_26', title:'Stray Animal Vaccination Drive', category:'animal', organizer:'Blue Cross of India', city:'Chennai', state:'Tamil Nadu', address:'Blue Cross Shelter, Velachery, Chennai', lat:12.9791, lng:80.2213, date:futureDate(2), startTime:'09:00', endTime:'14:00', volunteersNeeded:80, volunteersJoined:60, urgency:'live', description:'Free rabies vaccination and sterilization camp for stray dogs. Volunteers assist with handling, records, and post-care.', donationLink:'upi://pay?pa=bluecrossindia@hdfc', tags:['animal','vaccination'] },
  { id:'demo_ev_27', title:'Animal Shelter Adoption & Vaccination Fair', category:'animal', organizer:'RAWW — Resqink Association', city:'Pune', state:'Maharashtra', address:'RAWW Shelter Grounds, Baner, Pune', lat:18.5590, lng:73.7868, date:futureDate(4), startTime:'10:00', endTime:'17:00', volunteersNeeded:100, volunteersJoined:80, urgency:'upcoming', description:'Adoption drive, free vaccination, and microchipping for rescued animals. Volunteers needed for handling and adopter counselling.', tags:['animal','adoption'] },
  { id:'demo_ev_28', title:'Injured Bird Rescue & Rehab Camp', category:'animal', organizer:'Wildlife SOS Agra', city:'Agra', state:'Uttar Pradesh', address:'Wildlife SOS Bear Rescue Centre, Sur Sarovar', lat:27.1591, lng:77.9960, date:futureDate(5), startTime:'08:00', endTime:'12:00', volunteersNeeded:30, volunteersJoined:12, urgency:'upcoming', description:'Seasonal kite-string injury rescue for migratory and resident birds. First-aid and release training provided.', tags:['animal','birds','rescue'] },

  // ===== EDUCATION =====
  { id:'demo_ev_29', title:'Earthquake Preparedness Workshop', category:'education', organizer:'NDMA Civil Defence Cell', city:'New Delhi', state:'Delhi', address:'Community Centre, Dwarka Sector 12, New Delhi', lat:28.5921, lng:77.0460, date:futureDate(5), startTime:'11:00', endTime:'13:00', volunteersNeeded:30, volunteersJoined:12, urgency:'upcoming', description:'Hands-on training on earthquake drills, first aid, and household emergency kits, led by certified civil defence trainers.', tags:['education','safety','workshop'] },
  { id:'demo_ev_30', title:'Adult Literacy & Digital Skills Camp', category:'education', organizer:'Pratham Education Foundation', city:'Lucknow', state:'Uttar Pradesh', address:'Pratham Learning Centre, Aliganj, Lucknow', lat:26.8845, lng:80.9342, date:futureDate(7), startTime:'15:00', endTime:'18:00', volunteersNeeded:60, volunteersJoined:25, urgency:'upcoming', description:'Free literacy and basic smartphone/digital-payment training sessions for adult learners in the community.', tags:['education','literacy','digital'] },
  { id:'demo_ev_31', title:'Weekend STEM & Coding Bootcamp', category:'education', organizer:'VidyaConnect Nagpur', city:'Nagpur', state:'Maharashtra', address:'Sitabuldi Municipal School, Nagpur', lat:21.1436, lng:79.0806, date:futureDate(5), startTime:'10:00', endTime:'14:00', volunteersNeeded:30, volunteersJoined:19, urgency:'upcoming', description:'Hands-on science experiments and Scratch coding workshops for middle-school students from municipal schools.', tags:['education','stem','coding'] },
  { id:'demo_ev_32', title:'Rural Girl-Child Education Drive', category:'education', organizer:'Kiran Mahila Samiti Jodhpur', city:'Jodhpur', state:'Rajasthan', address:'Chopasni Housing Board School, Jodhpur', lat:26.2830, lng:73.0243, date:futureDate(9), startTime:'09:00', endTime:'13:00', volunteersNeeded:40, volunteersJoined:14, urgency:'upcoming', description:'Door-to-door enrollment campaign and free tutoring sessions for girls who have dropped out of school in rural wards.', tags:['education','girls','rural'] },

  // ===== TECH =====
  { id:'demo_ev_33', title:'Civic Tech Flood-Mapping Hackathon', category:'tech', organizer:'Tech4Good Bengaluru', city:'Bengaluru', state:'Karnataka', address:'91springboard Civic Hub, Koramangala, Bengaluru', lat:12.9352, lng:77.6245, date:futureDate(3), startTime:'10:00', endTime:'19:00', volunteersNeeded:90, volunteersJoined:64, urgency:'live', description:'Engineers, GIS mappers, and designers building open-source flood-alert dashboards and ward-level drainage maps.', tags:['tech','hackathon','civic'] },
  { id:'demo_ev_34', title:'Open-Source Health-Tech Accessibility Sprint', category:'tech', organizer:'CodeForPune Volunteers', city:'Pune', state:'Maharashtra', address:'Viman Nagar Civic Lab, Pune', lat:18.5679, lng:73.9143, date:futureDate(5), startTime:'10:00', endTime:'17:00', volunteersNeeded:50, volunteersJoined:36, urgency:'upcoming', description:'Developers and accessibility testers improving regional-language health portals for screen-reader users.', tags:['tech','accessibility'] },
  { id:'demo_ev_35', title:'AI for Agriculture Data-a-thon', category:'tech', organizer:'IIT Kharagpur AI Lab Alumni', city:'Kharagpur', state:'West Bengal', address:'Nehru Hall, IIT Kharagpur Campus', lat:22.3149, lng:87.3105, date:futureDate(10), startTime:'09:00', endTime:'21:00', volunteersNeeded:60, volunteersJoined:20, urgency:'upcoming', description:'Build ML models for crop-disease detection using satellite imagery. Open to students and professionals.', tags:['tech','AI','agriculture'] },

  // ===== SEMINAR =====
  { id:'demo_ev_36', title:'Youth Mental Health & First-Aid Seminar', category:'seminar', organizer:'MindCare Collective Chandigarh', city:'Chandigarh', state:'Chandigarh', address:'Tagore Theatre Auditorium, Sector 18, Chandigarh', lat:30.7415, lng:76.7849, date:futureDate(4), startTime:'11:00', endTime:'14:30', volunteersNeeded:120, volunteersJoined:78, urgency:'upcoming', description:'Interactive seminar with clinical psychologists on peer mental-health first aid, stress management, and campus support.', tags:['seminar','mental health','youth'] },
  { id:'demo_ev_37', title:'Women Safety & Legal Rights Seminar', category:'seminar', organizer:'Nyaya Manch Jaipur', city:'Jaipur', state:'Rajasthan', address:'Bapu Nagar Civic Auditorium, Jaipur', lat:26.8788, lng:75.8024, date:futureDate(4), startTime:'14:00', endTime:'17:30', volunteersNeeded:80, volunteersJoined:52, urgency:'upcoming', description:'Free legal-literacy seminar covering workplace rights, helpline resources, and self-defense basics.', tags:['seminar','legal','women'] },
  { id:'demo_ev_38', title:'Financial Literacy for Self-Help Groups', category:'seminar', organizer:'NABARD-SBLP Thiruvananthapuram', city:'Thiruvananthapuram', state:'Kerala', address:'Govt. Secretariat Annex Hall, Thiruvananthapuram', lat:8.5241, lng:76.9366, date:futureDate(8), startTime:'10:00', endTime:'13:00', volunteersNeeded:60, volunteersJoined:30, urgency:'upcoming', description:'Workshop on micro-credit, savings group accounting, and digital banking for women-led SHGs in rural Kerala.', tags:['seminar','finance','SHG'] },

  // ===== OTHER =====
  { id:'demo_ev_39', title:'Senior Citizen Digital Banking Helpdesk', category:'other', organizer:'Seva Sahyog Surat', city:'Surat', state:'Gujarat', address:'Athwa Lines Community Hall, Surat', lat:21.1782, lng:72.8087, date:futureDate(2), startTime:'09:30', endTime:'13:30', volunteersNeeded:35, volunteersJoined:21, urgency:'live', description:'One-on-one assistance helping senior citizens set up safe UPI, pension e-KYC, and spot phone scams.', tags:['others','seniors','digital literacy'] },
  { id:'demo_ev_40', title:'Rural Solar Lamp Assembly Workshop', category:'other', organizer:'Kalinga Clean Energy Trust', city:'Bhubaneswar', state:'Odisha', address:'Saheed Nagar Community Hall, Bhubaneswar', lat:20.2909, lng:85.8456, date:futureDate(6), startTime:'10:00', endTime:'15:00', volunteersNeeded:60, volunteersJoined:41, urgency:'upcoming', description:'Volunteers assemble and quality-check rechargeable solar study lamps for off-grid rural households.', tags:['others','solar','rural'] },
  { id:'demo_ev_41', title:'Heritage Monument Conservation Weekend', category:'other', organizer:'INTACH Mysuru Chapter', city:'Mysuru', state:'Karnataka', address:'Jaganmohan Palace Grounds, Mysuru', lat:12.3051, lng:76.6551, date:futureDate(7), startTime:'08:00', endTime:'13:00', volunteersNeeded:40, volunteersJoined:15, urgency:'upcoming', description:'Documenting and cleaning heritage stone inscriptions using non-invasive techniques. Photography enthusiasts welcome.', tags:['others','heritage','conservation'] },
  { id:'demo_ev_42', title:'Community Toilet Maintenance Drive', category:'other', organizer:'Sulabh International Patna', city:'Patna', state:'Bihar', address:'Kankarbagh Community Complex, Patna', lat:25.5990, lng:85.1283, date:futureDate(3), startTime:'07:00', endTime:'11:00', volunteersNeeded:50, volunteersJoined:22, urgency:'upcoming', description:'Deep cleaning, minor plumbing repair, and hygiene-awareness campaign at 10 public community toilets.', tags:['others','sanitation','hygiene'] },
  { id:'demo_ev_43', title:'Free Wi-Fi Hotspot Setup for Village Panchayat', category:'other', organizer:'Digital India Volunteers Imphal', city:'Imphal', state:'Manipur', address:'Khwairamband Bazaar, Imphal', lat:24.8074, lng:93.9384, date:futureDate(10), startTime:'09:00', endTime:'16:00', volunteersNeeded:20, volunteersJoined:5, urgency:'upcoming', description:'Tech volunteers setting up solar-powered Wi-Fi routers at five remote panchayat offices in Manipur.', tags:['others','digital','rural'] },

  // ===== MORE SPREAD: North-East, South, far corners =====
  { id:'demo_ev_44', title:'Earthquake Rubble Removal Volunteer Corps', category:'disaster', organizer:'Sikkim State Disaster Response Force', city:'Gangtok', state:'Sikkim', address:'MG Marg Relief Center, Gangtok', lat:27.3389, lng:88.6065, date:futureDate(2), startTime:'06:00', endTime:'18:00', volunteersNeeded:80, volunteersJoined:30, urgency:'critical', description:'Helping clear debris and salvage belongings from aftershock-damaged houses in lower Gangtok wards.', tags:['disaster','earthquake','northeast'] },
  { id:'demo_ev_45', title:'Coral Reef Monitoring Dive', category:'environment', organizer:'Andaman Reef Watch Foundation', city:'Port Blair', state:'Andaman & Nicobar', address:'Wandoor Beach Marine Park Jetty, Port Blair', lat:11.5879, lng:92.6372, date:futureDate(12), startTime:'06:30', endTime:'11:00', volunteersNeeded:20, volunteersJoined:8, urgency:'upcoming', description:'SCUBA-certified volunteers survey bleaching-affected reefs and collect water samples for the annual reef health report.', tags:['environment','marine','diving'] },
  { id:'demo_ev_46', title:'Ladakh Winter Blanket & Stove Drive', category:'disaster', organizer:'Leh Social Welfare Committee', city:'Leh', state:'Ladakh', address:'Main Bazaar Community Hall, Leh', lat:34.1526, lng:77.5771, date:futureDate(4), startTime:'10:00', endTime:'16:00', volunteersNeeded:30, volunteersJoined:10, urgency:'upcoming', description:'Collecting and distributing insulated blankets and kerosene stoves for nomadic Changpa families before winter sets in.', tags:['disaster','winter','Ladakh'] },
  { id:'demo_ev_47', title:'Organic Farming Seed Swap Mela', category:'other', organizer:'Navdanya Biodiversity Farm', city:'Dehradun', state:'Uttarakhand', address:'Navdanya Earth University, Ramgarh, Dehradun', lat:30.3540, lng:78.0893, date:futureDate(9), startTime:'09:00', endTime:'14:00', volunteersNeeded:40, volunteersJoined:20, urgency:'upcoming', description:'Farmers exchange indigenous seed varieties and learn organic pest-management techniques. Open to urban gardeners too.', tags:['others','organic','farming'] },
  { id:'demo_ev_48', title:'Rann of Kutch Water Conservation Camp', category:'environment', organizer:'Kutch Nav Nirman Abhiyan', city:'Bhuj', state:'Gujarat', address:'Hamirsar Lake Bund, Bhuj', lat:23.2420, lng:69.6669, date:futureDate(8), startTime:'07:00', endTime:'12:00', volunteersNeeded:100, volunteersJoined:40, urgency:'upcoming', description:'Building check-dams and bund repairs to harvest monsoon run-off in India\'s driest inhabited region.', tags:['environment','water','conservation'] },
  { id:'demo_ev_49', title:'Naga Heritage Weaving Documentation', category:'other', organizer:'North East Network Kohima', city:'Kohima', state:'Nagaland', address:'State Museum Annexe, Kohima', lat:25.6701, lng:94.1086, date:futureDate(11), startTime:'10:00', endTime:'15:00', volunteersNeeded:25, volunteersJoined:7, urgency:'upcoming', description:'Photographing and cataloguing endangered Naga tribal loom patterns with elder weavers. Bilingual volunteers preferred.', tags:['others','heritage','northeast'] },
  { id:'demo_ev_50', title:'Desert Tree Guard Installation', category:'environment', organizer:'Arna Jharna Desert Museum Jodhpur', city:'Jodhpur', state:'Rajasthan', address:'Arna Jharna Museum Road, Jodhpur', lat:26.2560, lng:72.9450, date:futureDate(7), startTime:'06:30', endTime:'10:30', volunteersNeeded:50, volunteersJoined:18, urgency:'upcoming', description:'Installing wire-mesh guards around young Khejri saplings to protect them from camels and goats in Thar Desert fringe villages.', tags:['environment','desert','trees'] },
];

const CONTACTS = {
  'demo_ev_01': { orgType:'NGO', contact:'+91 11 2371 6441', email:'bloodbank@indianredcross.org' },
  'demo_ev_02': { orgType:'Club', contact:'+91 80 2528 1122', email:'blood@rotarybengaluru.org' },
  'demo_ev_03': { orgType:'Club', contact:'+91 40 2311 5566', email:'service@lionshyderabad.org' },
  'demo_ev_04': { orgType:'NGO', contact:'+91 891 256 7733', email:'donors@vizagblood.org' },
  'demo_ev_05': { orgType:'NGO', contact:'+91 281 244 5500', email:'rajkot@thalassemia.org' },
  'demo_ev_06': { orgType:'NGO', contact:'+91 11 2371 6441', email:'medical@indianredcross.org' },
  'demo_ev_07': { orgType:'Hospital', contact:'+91 452 435 6100', email:'camps@aravind.org' },
  'demo_ev_08': { orgType:'NGO', contact:'+91 141 272 3344', email:'camps@smilefoundation.org' },
  'demo_ev_09': { orgType:'Hospital', contact:'+91 731 253 9900', email:'camps@janswasthyaindore.org' },
  'demo_ev_10': { orgType:'Government Body', contact:'+91 542 236 8800', email:'rntcp.varanasi@gov.in' },
  'demo_ev_11': { orgType:'NGO', contact:'+91 22 2404 1234', email:'mumbai@akshayapatra.org' },
  'demo_ev_12': { orgType:'Community Group', contact:'+91 33 2282 5566', email:'kolkata@robinhoodarmy.com' },
  'demo_ev_13': { orgType:'NGO', contact:'+91 183 255 6677', email:'seva@khalsaaid.org' },
  'demo_ev_14': { orgType:'NGO', contact:'+91 79 2687 2345', email:'midday@iskonahmedabad.org' },
  'demo_ev_15': { orgType:'Community Group', contact:'+91 651 222 8800', email:'asha.ranchi@health.gov.in' },
  'demo_ev_16': { orgType:'Government Body', contact:'+91 612 221 4455', email:'relief.patna@ndrf.gov.in' },
  'demo_ev_17': { orgType:'NGO', contact:'+91 755 246 1122', email:'relief@seedsindia.org' },
  'demo_ev_18': { orgType:'Community Group', contact:'+91 361 254 8811', email:'relief@assamcollective.org' },
  'demo_ev_19': { orgType:'NGO', contact:'+91 11 4168 8955', email:'delhi@helpageindia.org' },
  'demo_ev_20': { orgType:'Government Body', contact:'+91 674 253 4400', email:'osdma@odisha.gov.in' },
  'demo_ev_21': { orgType:'Community Group', contact:'+91 135 274 8899', email:'green@uttarakhand.org' },
  'demo_ev_22': { orgType:'NGO', contact:'+91 484 236 7788', email:'nature@cochin.org' },
  'demo_ev_23': { orgType:'Community Group', contact:'+91 79 2658 3322', email:'green@ahmedabad.org' },
  'demo_ev_24': { orgType:'NGO', contact:'+91 33 2440 6677', email:'info@sundarbantrust.org' },
  'demo_ev_25': { orgType:'NGO', contact:'+91 1892 220 456', email:'info@wastewarriors.org' },
  'demo_ev_26': { orgType:'NGO', contact:'+91 44 2235 4980', email:'help@bluecross.org' },
  'demo_ev_27': { orgType:'NGO', contact:'+91 20 2729 3344', email:'info@raww.in' },
  'demo_ev_28': { orgType:'NGO', contact:'+91 562 233 4455', email:'agra@wildlifesos.org' },
  'demo_ev_29': { orgType:'Government Body', contact:'+91 11 2670 1700', email:'training@ndma.gov.in' },
  'demo_ev_30': { orgType:'NGO', contact:'+91 522 232 4455', email:'lucknow@pratham.org' },
  'demo_ev_31': { orgType:'NGO', contact:'+91 712 252 4433', email:'stem@vidyaconnect.org' },
  'demo_ev_32': { orgType:'Community Group', contact:'+91 291 254 7700', email:'kiran@mahilasamiti.org' },
  'demo_ev_33': { orgType:'Tech Collective', contact:'+91 80 4123 7788', email:'hello@tech4goodblr.org' },
  'demo_ev_34': { orgType:'Tech Collective', contact:'+91 20 2668 9944', email:'team@codeforpune.org' },
  'demo_ev_35': { orgType:'Academic', contact:'+91 3222 282 000', email:'ailab-alumni@iitkgp.ac.in' },
  'demo_ev_36': { orgType:'Community Group', contact:'+91 172 270 4411', email:'care@mindcarechd.org' },
  'demo_ev_37': { orgType:'NGO', contact:'+91 141 270 5522', email:'legal@nyayamanch.org' },
  'demo_ev_38': { orgType:'Government Body', contact:'+91 471 232 1100', email:'sblp@nabard.org' },
  'demo_ev_39': { orgType:'NGO', contact:'+91 261 247 8899', email:'help@sevasurat.org' },
  'demo_ev_40': { orgType:'NGO', contact:'+91 674 254 2211', email:'solar@kalingatrust.org' },
  'demo_ev_41': { orgType:'NGO', contact:'+91 821 242 5566', email:'mysuru@intach.org' },
  'demo_ev_42': { orgType:'NGO', contact:'+91 612 265 3300', email:'patna@sulabh.org' },
  'demo_ev_43': { orgType:'Community Group', contact:'+91 385 244 1100', email:'digital@imphalvolunteers.org' },
  'demo_ev_44': { orgType:'Government Body', contact:'+91 3592 202 345', email:'sdrf@sikkim.gov.in' },
  'demo_ev_45': { orgType:'NGO', contact:'+91 3192 232 694', email:'info@reefwatch.org' },
  'demo_ev_46': { orgType:'Community Group', contact:'+91 1982 252 100', email:'welfare@lehcommittee.org' },
  'demo_ev_47': { orgType:'NGO', contact:'+91 135 268 2211', email:'info@navdanya.org' },
  'demo_ev_48': { orgType:'NGO', contact:'+91 2832 256 100', email:'info@kutchabhiyan.org' },
  'demo_ev_49': { orgType:'Community Group', contact:'+91 370 229 0011', email:'kohima@northeastnetwork.org' },
  'demo_ev_50': { orgType:'NGO', contact:'+91 291 272 8800', email:'info@arnajharna.org' },
};

async function seed() {
  console.log('🔗 Connecting to Supabase...');
  const client = await pool.connect();
  console.log('✅ Connected.\n');

  try {
    // First, delete any old demo events (clean slate)
    const demoIds = EVENTS.map(e => e.id);
    await client.query('DELETE FROM event_contacts WHERE event_id = ANY($1::varchar[])', [demoIds]);
    await client.query('DELETE FROM events WHERE id = ANY($1::varchar[])', [demoIds]);
    console.log('🗑️  Cleared old demo events (if any).\n');

    let inserted = 0;
    for (const ev of EVENTS) {
      await client.query(
        `INSERT INTO events (id, title, category, organizer, verified, city, state, address, lat, lng, date, start_time, end_time, volunteers_needed, volunteers_joined, urgency, description, donation_link, tags, status)
         VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'approved')
         ON CONFLICT (id) DO NOTHING`,
        [ev.id, ev.title, ev.category, ev.organizer, ev.city, ev.state || '', ev.address,
         ev.lat, ev.lng, ev.date, ev.startTime, ev.endTime,
         ev.volunteersNeeded, ev.volunteersJoined, ev.urgency,
         ev.description, ev.donationLink || null, ev.tags || []]
      );

      const contact = CONTACTS[ev.id];
      if (contact) {
        await client.query(
          `INSERT INTO event_contacts (event_id, org_type, contact, email)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (event_id) DO NOTHING`,
          [ev.id, contact.orgType, contact.contact, contact.email]
        );
      }
      inserted++;
      process.stdout.write(`\r   📌 Inserted ${inserted}/${EVENTS.length} events...`);
    }

    console.log(`\n\n✅ Successfully seeded ${inserted} demo events across India into Supabase!`);
    console.log('\n📍 Cities covered:');
    const cities = [...new Set(EVENTS.map(e => `${e.city}, ${e.state}`))].sort();
    cities.forEach(c => console.log(`   • ${c}`));
    console.log(`\n📂 Categories: ${[...new Set(EVENTS.map(e => e.category))].join(', ')}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
