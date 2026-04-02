const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = xlsx.readFile('c:/Users/81809/Downloads/無題のスプレッドシート (2).xlsx');
const sheetName = wb.SheetNames[0];
const rawData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);

console.log(`Raw rows from Excel: ${rawData.length}`);

// Classify each entry as 'word' or 'sentence'
function classifyType(english) {
  const trimmed = english.trim().replace(/\.$/, ''); // Remove trailing period
  const spaceCount = (trimmed.match(/ /g) || []).length;
  const wordCount = trimmed.split(/\s+/).length;
  
  if (wordCount <= 3 && trimmed.length <= 40) {
    return 'word';
  }
  return 'sentence';
}

// Split cells that contain multiple items (e.g. "apple, banana" / "りんご、バナナ")
function splitMultipleItems(english, japanese) {
  const enTrimmed = english.trim();
  const jpTrimmed = japanese.trim();
  
  // Check for numbered patterns like "1. xxx 2. xxx"
  const enNumbered = enTrimmed.match(/\d+\.\s+[^0-9]+/g);
  const jpNumbered = jpTrimmed.match(/\d+\.\s+[^0-9]+/g);
  if (enNumbered && jpNumbered && enNumbered.length === jpNumbered.length && enNumbered.length > 1) {
    return enNumbered.map((en, i) => ({
      english: en.replace(/^\d+\.\s+/, '').trim(),
      japanese: jpNumbered[i].replace(/^\d+\.\s+/, '').trim()
    }));
  }
  
  // Check for comma/semicolon separated (only for short entries that look like word lists)
  const enParts = enTrimmed.split(/[,;]\s*/);
  const jpParts = jpTrimmed.split(/[,;、；]\s*/);
  
  if (enParts.length > 1 && jpParts.length === enParts.length && enParts.every(p => p.split(/\s+/).length <= 3)) {
    return enParts.map((en, i) => ({
      english: en.trim(),
      japanese: jpParts[i].trim()
    }));
  }
  
  // No splitting needed
  return [{ english: enTrimmed, japanese: jpTrimmed }];
}

const allItems = [];
let splitCount = 0;

for (const row of rawData) {
  const en = String(row['英語'] || '').trim();
  const jp = String(row['日本語'] || '').trim();
  
  if (!en || !jp) continue;
  
  const items = splitMultipleItems(en, jp);
  if (items.length > 1) splitCount++;
  
  for (const item of items) {
    allItems.push({
      id: allItems.length + 1,
      english: item.english,
      japanese: item.japanese,
      type: classifyType(item.english)
    });
  }
}

const wordCount = allItems.filter(i => i.type === 'word').length;
const sentenceCount = allItems.filter(i => i.type === 'sentence').length;

console.log(`\nProcessing complete:`);
console.log(`  Total items: ${allItems.length}`);
console.log(`  Words: ${wordCount}`);
console.log(`  Sentences: ${sentenceCount}`);
console.log(`  Rows that were split: ${splitCount}`);
console.log(`\nSample words:`);
allItems.filter(i => i.type === 'word').slice(0, 5).forEach(i => console.log(`  ${i.japanese} -> ${i.english}`));
console.log(`\nSample sentences:`);
allItems.filter(i => i.type === 'sentence').slice(0, 5).forEach(i => console.log(`  ${i.japanese} -> ${i.english}`));

// Write to JSON
const outputPath = path.join(__dirname, '..', 'src', 'data', 'vocabulary.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(allItems, null, 2), 'utf-8');
console.log(`\nSaved to: ${outputPath}`);
