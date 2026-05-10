const fs = require('fs');
const path = 'frontend/src/index.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix action-controls-container on mobile
content = content.replace(
  /(\.action-controls-container\s*\{[^}]*top:\s*)4\.2rem/g,
  '$14.8rem'
);
content = content.replace(
  /(\.action-controls-container\s*\{[^}]*right:\s*)1\.25rem/g,
  '$11.5rem'
);
content = content.replace(
  /(\.action-controls-container\s*\{[^}]*gap:\s*)0\.75rem/g,
  '$11.2rem'
);

// 2. Add .desktop-quit-btn { display: none !important; } inside the media query
if (!content.includes('.desktop-quit-btn')) {
    content = content.replace(
        /(\.action-controls-container\s*\{[^}]*\}\s*)(?=\.action-divider)/,
        '$1\n  .desktop-quit-btn {\n    display: none !important;\n  }\n\n  '
    );
}

fs.writeFileSync(path, content);
console.log('Successfully updated index.css');
