#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function escapeMarkdown(text) {
  return String(text).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function findFiles(dir, pattern) {
  const results = [];
  
  function walk(directory) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (stat.isFile() && pattern.test(filePath)) {
        results.push(filePath);
      }
    }
  }
  
  walk(dir);
  return results;
}

function parseFrontMatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    if (!lines[0] || lines[0].trim() !== '---') {
      return null;
    }
    
    const fmLines = [];
    let i = 1;
    
    while (i < lines.length && lines[i].trim() !== '---') {
      fmLines.push(lines[i]);
      i++;
    }
    
    if (i >= lines.length || lines[i].trim() !== '---') {
      return null;
    }
    
    const frontMatter = yaml.load(fmLines.join('\n'));
    return frontMatter;
  } catch (e) {
    console.error(`YAML error in ${filePath}: ${e.message}`);
    return null;
  }
}

const entries = [];

// Find all index.md files
const files = findFiles('content/.', /index\.md$/);

for (const filePath of files) {
  // Skip ./index.md and ./_index.md
  if (filePath.includes('./index.md') || filePath.includes('./_index.md')) {
    continue;
  }
  
  const frontMatter = parseFrontMatter(filePath);
  
  if (frontMatter && frontMatter.title && frontMatter.date) {
    try {
      const date = new Date(frontMatter.date);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        continue;
      }
      
      // Convert path to URL (normalize path separators)
      let url = filePath
        .replace(/\\/g, '/') // Convert backslashes to forward slashes
        .replace('content/', '')
        .replace('./', '')
        .replace('/index.md', '/');
      
      entries.push({
        title: frontMatter.title,
        url: url,
        date: date
      });
    } catch (e) {
      // Skip entries with invalid dates
      continue;
    }
  }
}

// Sort newest first
entries.sort((a, b) => b.date.getTime() - a.date.getTime());

// Group by year and month
const grouped = {};

for (const entry of entries) {
  const year = entry.date.getFullYear();
  const month = entry.date.getMonth() + 1; // JS months are 0-indexed
  const key = `${year}-${month}`;
  
  if (!grouped[key]) {
    grouped[key] = {
      year: year,
      month: month,
      posts: []
    };
  }
  
  grouped[key].posts.push(entry);
}

// Sort year-month keys descending
const sortedKeys = Object.keys(grouped).sort().reverse();

// Month names
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate output
let output = '---\n';
output += "title: AkitaOnRails's Blog\n";
output += '---\n\n';

for (const key of sortedKeys) {
  const group = grouped[key];
  const monthName = monthNames[group.month - 1];
  
  output += `## ${group.year} - ${monthName}\n\n`;
  
  // Sort posts within each month by date (newest first)
  group.posts.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  for (const post of group.posts) {
    const title = escapeMarkdown(post.title);
    output += `- [${title}](${post.url})\n`;
  }
  
  output += '\n';
}

// Write to file
fs.writeFileSync('content/_index.md', output);

console.log('Generated _index.md with posts grouped by year & month.');