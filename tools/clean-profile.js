// Node.js cleaning script — starter
// Usage: node clean-profile.js sample-profile.json
// Requires: npm i libphonenumber-js

const fs = require('fs');
const path = require('path');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

function normalizePhone(rawPhone, country='US'){
  if (!rawPhone) return null;
  try{
    const p = parsePhoneNumberFromString(rawPhone, country);
    if (!p || !p.isValid()) return rawPhone.replace(/[^0-9+]/g,'');
    return p.number; // E.164
  }catch(e){ return rawPhone.replace(/[^0-9+]/g,''); }
}

function normalizeWebsite(raw){
  if (!raw) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const parsed = new URL(u); parsed.hash=''; parsed.search=''; return parsed.toString(); } catch { return null; }
}

function titleCaseName(name){
  if (!name) return name;
  return name.replace(/\s+/g,' ').trim().split(' ').map(w=>{
    if (w.toUpperCase() === w && w.length <= 5) return w; // keep acronyms
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function cleanDescription(desc, max=3000){
  if (!desc) return desc;
  let s = desc.replace(/[\x00-\x1F\x7F]/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max) + '...';
  return s;
}

function diff(original, cleaned){
  const changes = {};
  for (const k of Object.keys(cleaned)){
    if (JSON.stringify(original[k]) !== JSON.stringify(cleaned[k])){
      changes[k] = { before: original[k], after: cleaned[k] };
    }
  }
  return changes;
}

function cleanProfile(profile, options={}){
  const country = (profile.address && profile.address.country) || options.country || 'US';
  const before = JSON.parse(JSON.stringify(profile));
  const cleaned = JSON.parse(JSON.stringify(profile));

  // Normalize name
  cleaned.title = titleCaseName(cleaned.title || cleaned.name || '');

  // Normalize phone
  if (cleaned.phone) cleaned.phone = normalizePhone(cleaned.phone, country);

  // Normalize website
  if (cleaned.website) cleaned.website = normalizeWebsite(cleaned.website);

  // Normalize email (basic)
  if (cleaned.email) {
    cleaned.email = cleaned.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) cleaned.email = null;
  }

  // Description cleanup
  cleaned.description = cleanDescription(cleaned.description, options.maxDescription || 7500);

  // Trim all string fields and remove control chars
  for (const k of Object.keys(cleaned)){
    if (typeof cleaned[k] === 'string'){
      cleaned[k] = cleaned[k].replace(/[\x00-\x1F\x7F]/g,' ').trim();
    }
  }

  // Hours sanity check (simple)
  if (cleaned.hours && Array.isArray(cleaned.hours)){
    cleaned.hours = cleaned.hours.filter(h=>{
      return h.open && h.close && typeof h.open === 'string' && typeof h.close === 'string';
    });
  }

  // Ensure categories array unique and non-empty
  if (cleaned.categories && Array.isArray(cleaned.categories)){
    cleaned.categories = Array.from(new Set(cleaned.categories.map(c=>c && c.trim()).filter(Boolean)));
    if (cleaned.categories.length === 0) cleaned.categories = null;
  }

  const changes = diff(before, cleaned);
  return { cleaned, changes };
}

// CLI usage
if (require.main === module){
  const file = process.argv[2];
  if (!file) { console.error('Usage: node clean-profile.js sample-profile.json'); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { cleaned, changes } = cleanProfile(data);
  const outPath = path.basename(file, path.extname(file)) + '.cleaned.json';
  fs.writeFileSync(outPath, JSON.stringify({ cleaned, changes }, null, 2));
  console.log(`Wrote cleaned profile + changes to ${outPath}`);
}

module.exports = { cleanProfile };
