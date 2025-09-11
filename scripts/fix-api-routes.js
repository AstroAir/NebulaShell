const fs = require('fs');
const path = require('path');

function findApiRoutes(dir) {
  const routes = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      routes.push(...findApiRoutes(fullPath));
    } else if (item === 'route.ts') {
      routes.push(fullPath);
    }
  }
  
  return routes;
}

function addExportConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if it already has export const dynamic
  if (content.includes('export const dynamic')) {
    console.log(`Skipping ${filePath} - already has export config`);
    return;
  }
  
  // Find the first import statement
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      // Found empty line after imports
      break;
    }
  }
  
  // Insert the export config
  lines.splice(insertIndex, 0, '', '// Required for static export', 'export const dynamic = \'force-static\';');
  
  const newContent = lines.join('\n');
  fs.writeFileSync(filePath, newContent);
  console.log(`Added export config to ${filePath}`);
}

// Find all API routes
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const routes = findApiRoutes(apiDir);

console.log(`Found ${routes.length} API routes:`);
routes.forEach(route => console.log(`  ${route}`));

// Add export config to each route
routes.forEach(addExportConfig);

console.log('Done!');
