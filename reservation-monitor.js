#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CONFIG_PATH = path.join(__dirname, 'restaurants-config.json');
const STATUS_PATH = path.join(__dirname, 'reservation-status.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));

// Email transporter for SMS
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendNotification(restaurant, availability) {
  const message = `
RESERVATION ALERT: ${restaurant.name}

Available: ${availability.date} at ${availability.time}
Party size: ${restaurant.party_size}
Cancellation policy: ${restaurant.cancellation_hours} hours

${availability.bookingUrl ? `Book here: ${availability.bookingUrl}` : 'Check availability manually'}

Reply "keep" to confirm, "drop" to cancel.
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: config.email_to_sms,
      subject: `Res: ${restaurant.name}`,
      text: message,
    });
    console.log(`✓ Notified about ${restaurant.name}`);
  } catch (error) {
    console.error(`✗ Failed to notify about ${restaurant.name}:`, error.message);
  }
}

async function checkResyRestaurant(restaurant) {
  // Resy restaurant URLs follow pattern: https://resy.com/cities/new-york-ny/venues/{slug}
  const resyUrl = `https://resy.com/cities/new-york-ny/venues/${restaurant.id}`;

  console.log(`\nChecking ${restaurant.name} on Resy...`);
  console.log(`Visit: ${resyUrl}`);
  console.log(`Look for available times on: ${config.preferred_days.join(', ')}`);
  console.log(`Minimum days out: ${restaurant.cancellation_hours / 24}`);

  // TODO: Implement actual scraping with puppeteer
  return null;
}

async function checkSevenroomsRestaurant(restaurant) {
  // Sevenrooms URLs vary by restaurant
  const sevenroomsUrl = 'https://www.sevenrooms.com/';

  console.log(`\nChecking ${restaurant.name} on Sevenrooms...`);
  console.log(`Visit: ${sevenroomsUrl} and search for ${restaurant.name}`);
  console.log(`Look for available times on: ${config.preferred_days.join(', ')}`);

  // TODO: Implement actual scraping
  return null;
}

async function checkOpenTableRestaurant(restaurant) {
  const otUrl = `https://www.opentable.com/r/${restaurant.id.replace(/-/g, '-')}-new-york`;

  console.log(`\nChecking ${restaurant.name} on OpenTable...`);
  console.log(`Visit: ${otUrl}`);
  console.log(`Look for available times on: ${config.preferred_days.join(', ')}`);
  console.log(`Note: No fixed opening time - slots may appear anytime`);

  // TODO: Implement actual scraping
  return null;
}

async function promptForStatus() {
  // In a real routine, this would be interactive
  // For now, log which restaurants are active
  console.log('\n=== HUNTING STATUS ===');
  Object.entries(status.hunting).forEach(([id, isHunting]) => {
    const restaurant = config.restaurants.find(r => r.id === id);
    console.log(`${isHunting ? '✓' : '✗'} ${restaurant.name}`);
  });
  console.log('\nTo update hunting status, edit reservation-status.json');
}

async function main() {
  console.log('🔍 Reservation Monitor - Starting checks...\n');

  await promptForStatus();

  // Check each restaurant if hunting
  for (const restaurant of config.restaurants) {
    if (!status.hunting[restaurant.id]) {
      console.log(`⊘ Skipping ${restaurant.name} (not hunting)`);
      continue;
    }

    if (status.booked[restaurant.id]) {
      console.log(`✓ Already booked at ${restaurant.name}`);
      continue;
    }

    try {
      if (restaurant.platform === 'resy') {
        await checkResyRestaurant(restaurant);
      } else if (restaurant.platform === 'sevenrooms') {
        await checkSevenroomsRestaurant(restaurant);
      } else if (restaurant.platform === 'opentable') {
        await checkOpenTableRestaurant(restaurant);
      }
    } catch (error) {
      console.error(`✗ Error checking ${restaurant.name}:`, error.message);
    }
  }

  console.log('\n✓ Check complete. Monitoring...\n');
}

main().catch(console.error);
