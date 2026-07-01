const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load env variables to get custom git path if defined
const envPath = path.join(__dirname, '.env');
let gitCmd = 'git';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const index = trimmed.indexOf('=');
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'GIT_PATH') {
          gitCmd = value;
        }
      }
    }
  });
}

const gitRepoUrl = 'https://github.com/BLESSED22456/BLESSED.git';
console.log(`Git command configured as: "${gitCmd}"`);
console.log(`Target Repository: "${gitRepoUrl}"`);

let debounceTimer = null;
const DEBOUNCE_DELAY = 10000; // 10 seconds of silence before committing and pushing

const ignoredPaths = [
  'node_modules',
  '.git',
  '.env',
  '.vercel',
  'watch_push.js',
  'push.bat'
];

function shouldIgnore(filePath) {
  return ignoredPaths.some(ignored => {
    const relative = path.relative(__dirname, filePath);
    return relative.startsWith(ignored) || relative.split(path.sep).includes(ignored);
  });
}

function runGitPush() {
  console.log('\n--- Change detected! Starting Auto-Push to GitHub ---');
  
  // Check if git is initialized
  exec(`"${gitCmd}" rev-parse --is-inside-work-tree`, (err) => {
    if (err) {
      console.log('Git is not initialized in this directory. Initializing repository...');
      exec(`"${gitCmd}" init && "${gitCmd}" branch -M main && "${gitCmd}" remote add origin ${gitRepoUrl}`, (initErr) => {
        if (initErr) {
          console.error('Failed to initialize Git repository:', initErr.message);
          return;
        }
        console.log('Git repository initialized and linked to GitHub.');
        configureIdentityAndCommit();
      });
    } else {
      // Check if remote is added
      exec(`"${gitCmd}" remote get-url origin`, (remoteErr) => {
        if (remoteErr) {
          console.log('Adding remote origin...');
          exec(`"${gitCmd}" remote add origin ${gitRepoUrl}`, (addRemoteErr) => {
            if (addRemoteErr) {
              console.error('Failed to add remote:', addRemoteErr.message);
              return;
            }
            configureIdentityAndCommit();
          });
        } else {
          configureIdentityAndCommit();
        }
      });
    }
  });
}

function configureIdentityAndCommit() {
  // Ensure local identity is configured
  exec(`"${gitCmd}" config user.email`, (emailErr) => {
    if (emailErr) {
      console.log('Configuring local Git identity...');
      exec(`"${gitCmd}" config user.email "h56797771@gmail.com" && "${gitCmd}" config user.name "BLESSED"`, (configErr) => {
        if (configErr) {
          console.error('Failed to configure local identity:', configErr.message);
          return;
        }
        stageAndCommit();
      });
    } else {
      stageAndCommit();
    }
  });
}

function stageAndCommit() {
  const commitMsg = `Storefront Auto-Update: ${new Date().toLocaleString()}`;
  console.log(`Running git add and committing with message: "${commitMsg}"`);
  
  exec(`"${gitCmd}" add .`, (addErr) => {
    if (addErr) {
      console.error('Git add failed:', addErr.message);
      return;
    }
    
    exec(`"${gitCmd}" commit -m "${commitMsg}"`, (commitErr) => {
      if (commitErr && !commitErr.message.includes('nothing to commit')) {
        console.log('Git status/commit response:', commitErr.message);
      }
      
      console.log('Pushing changes to GitHub...');
      exec(`"${gitCmd}" push -u origin main`, (pushErr, pushStdout, pushStderr) => {
        if (pushErr) {
          console.error('Git push failed:', pushErr.message);
          return;
        }
        console.log('Successfully pushed changes to GitHub! Vercel will now deploy your site automatically.');
        console.log(pushStdout || pushStderr);
      });
    });
  });
}

// Watch directory recursively for updates
console.log('Watching directory for file updates... (excluding ignored directories)');
fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  const fullPath = path.join(__dirname, filename);
  
  if (shouldIgnore(fullPath)) return;
  
  console.log(`File change detected: ${filename} (${eventType})`);
  
  // Debounce pushing so multiple saves only trigger a single push
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runGitPush();
  }, DEBOUNCE_DELAY);
});
