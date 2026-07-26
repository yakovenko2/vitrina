const fs = require('fs');
const path = require('path');
const dir = 'D:/vitrina/owner-admin';

// Search target
const target = '<link rel="stylesheet" href="/owner-admin/styles.css" />';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.indexOf(target) !== -1) {
      // Find indentation by looking at the target's preceding spaces
      const index = content.indexOf(target);
      let indent = '';
      for (let i = index - 1; i >= 0; i--) {
        if (content[i] === ' ' || content[i] === '\t') {
          indent = content[i] + indent;
        } else {
          break;
        }
      }
      
      const replacement = '<link rel="stylesheet" href="/owner-admin/styles.css" />\n' + indent + '<link rel="stylesheet" href="styles.css" />';
      content = content.replace(target, replacement);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated: ' + file);
    } else {
      console.log('Skipped (target not found): ' + file);
    }
  }
});
