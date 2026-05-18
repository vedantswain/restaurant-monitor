const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3002;

const CONFIG_PATH = path.join(__dirname, 'restaurants-config.json');
const STATUS_PATH = path.join(__dirname, 'reservation-status.json');

let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
let status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/api/status', (req, res) => {
  res.json({
    hunting: status.hunting,
    booked: status.booked,
    lastChecked: status.lastChecked,
    latestAvailable: status.latestAvailable,
    restaurants: config.restaurants,
    lastUpdated: new Date().toISOString(),
  });
});

app.post('/api/hunting/:id', (req, res) => {
  const { id } = req.params;
  const { hunting } = req.body;

  if (status.hunting.hasOwnProperty(id)) {
    status.hunting[id] = hunting;
    fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
    res.json({ success: true, hunting: status.hunting });
  } else {
    res.status(400).json({ error: 'Restaurant not found' });
  }
});

app.post('/api/booked/:id', (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;

  if (date && time) {
    status.booked[id] = { date, time, bookedAt: new Date().toISOString() };
  } else {
    delete status.booked[id];
  }

  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  res.json({ success: true, booked: status.booked[id] });
});

app.post('/api/lastChecked/:id', (req, res) => {
  const { id } = req.params;
  status.lastChecked[id] = new Date().toISOString();
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  res.json({ success: true, lastChecked: status.lastChecked[id] });
});

app.post('/api/latestAvailable/:id', (req, res) => {
  const { id } = req.params;
  const { date } = req.body;

  if (date) {
    status.latestAvailable[id] = date;
  } else {
    delete status.latestAvailable[id];
  }

  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  res.json({ success: true, latestAvailable: status.latestAvailable[id] });
});

app.post('/api/restaurant', (req, res) => {
  const newRestaurant = req.body;

  if (!newRestaurant.id || !newRestaurant.name || !newRestaurant.platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  config.restaurants.push(newRestaurant);
  status.hunting[newRestaurant.id] = true;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

  res.json({ success: true, restaurant: newRestaurant });
});

app.delete('/api/restaurant/:id', (req, res) => {
  const { id } = req.params;

  const index = config.restaurants.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  config.restaurants.splice(index, 1);
  delete status.hunting[id];
  delete status.booked[id];
  delete status.lastChecked[id];
  delete status.latestAvailable[id];

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cron jobs for checking availability
const checkAvailability = async (restaurantIds) => {
  console.log(`[${new Date().toISOString()}] Checking availability for:`, restaurantIds);

  for (const id of restaurantIds) {
    const restaurant = config.restaurants.find(r => r.id === id);
    if (!restaurant) continue;

    if (!status.hunting[id]) {
      console.log(`⊘ ${restaurant.name} - not hunting`);
      continue;
    }

    if (status.booked[id]) {
      console.log(`✓ ${restaurant.name} - already booked`);
      continue;
    }

    // TODO: Implement actual scraping for each platform
    console.log(`🔍 Checking ${restaurant.name} (${restaurant.platform})`);
    console.log(`   → ${getResaurantUrl(restaurant)}`);
  }
};

const getResaurantUrl = (restaurant) => {
  if (restaurant.platform === 'resy') {
    return `https://resy.com/cities/new-york-ny/venues/${restaurant.id}`;
  } else if (restaurant.platform === 'sevenrooms') {
    return 'https://www.sevenrooms.com/';
  } else if (restaurant.platform === 'opentable') {
    return `https://www.opentable.com/r/${restaurant.id}-new-york`;
  }
};

// Schedule cron jobs
// 9:00 AM - Check fixed-time openers (Semma, Dhamaka)
cron.schedule('0 9 * * *', () => {
  console.log('Running 9:00 AM check');
  checkAvailability(['semma', 'dhamaka']);
});

// 11:00 AM - Check Kidilum + variable openers
cron.schedule('0 11 * * *', () => {
  console.log('Running 11:00 AM check');
  checkAvailability(['kidilum', 'fish-cheeks', 'hi-collar', 'the-gallery-odo']);
});

// 4:30 PM - Afternoon check for variable openers
cron.schedule('30 16 * * *', () => {
  console.log('Running 4:30 PM check');
  checkAvailability(['fish-cheeks', 'hi-collar', 'the-gallery-odo']);
});

// 1st & 15th at noon - Check Ambassador & Joo Ok
cron.schedule('0 12 1,15 * *', () => {
  console.log('Running 1st & 15th check');
  checkAvailability(['ambassador', 'joo-ok']);
});

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`→ Dashboard: http://localhost:${PORT}`);
});
