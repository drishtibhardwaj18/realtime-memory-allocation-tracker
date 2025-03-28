const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const util = require("util");

// Promisify exec for async/await
const execPromise = util.promisify(exec);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

function getSystemMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    total: (total / 1024 / 1024 / 1024).toFixed(2),
    free: (free / 1024 / 1024 / 1024).toFixed(2),
    used: ((total - free) / 1024 / 1024 / 1024).toFixed(2),
    timestamp: new Date().toISOString(),
  };
}

// Helper function to extract app name from process
function extractAppName(command, platform) {
  if (platform === "darwin") {
    // macOS
    if (command.startsWith("/System/")) {
      const parts = command.split("/");
      const name = parts[parts.length - 1];
      return { appName: "System", processName: name };
    }

    const appMatch = command.match(/\/Applications\/([^\/]+)\.app/);
    if (appMatch) {
      const appName = appMatch[1];
      return { appName, processName: appName };
    }

    const name = command.split("/").pop();
    return { appName: name || "Other", processName: name || "Unknown" };
  } else if (platform === "win32") {
    // Windows
    let appName = command.replace(/\.exe$/i, "");
    let processName = appName;

    const windowsAppMap = {
      chrome: "Google Chrome",
      msedge: "Microsoft Edge",
      firefox: "Firefox",
      notepad: "Notepad",
      explorer: "File Explorer",
      taskmgr: "Task Manager",
      powershell: "PowerShell",
      cmd: "Command Prompt",
      code: "Visual Studio Code",
      slack: "Slack",
      zoom: "Zoom",
      docker: "Docker",
      iterm: "iTerm",
    };

    appName = windowsAppMap[appName.toLowerCase()] || appName;
    return { appName, processName };
  }

  return { appName: "Other", processName: command || "Unknown" };
}

// Mapping of app names to inline SVG icons (from Simple Icons)
const appIconMap = {
  "Google Chrome": `/icons/Google_Chrome.png`,
  "Visual Studio Code": `/icons/VS_Code.png`,
  Spotlight: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm4-8c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4zm-1.5 0c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z"/></svg>`,
  Finder: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0A97D9" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm4 4h8v2H8V8zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>`,
  Safari: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm-1-14h2v8h-2V8zm1-2a1 1 0 100-2 1 1 0 000 2z"/></svg>`,
  Terminal: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v2H7V7zm4 0h6v2h-6V7zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2z"/></svg>`,
  System: `/icons/System.webp`,
  Firefox: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#FF7139" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.5 17.5c0 1.933-1.567 3.5-3.5 3.5S8.5 19.433 8.5 17.5V12h-2v5.5C6.5 20.537 9.463 23 12.5 23S18.5 20.537 18.5 17.5V12h-2v5.5zM12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm0 2c-4.411 0-8 3.589-8 8s3.589 8 8 8 8-3.589 8-8-3.589-8-8-8z"/></svg>`,
  Slack: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4A154B" d="M5.042 9.367a2.625 2.625 0 015.25 0v5.25a2.625 2.625 0 01-5.25 0v-5.25zm2.625-2.625a2.625 2.625 0 010 5.25H2.417a2.625 2.625 0 010-5.25h5.25zm11.916 2.625a2.625 2.625 0 010 5.25h-5.25a2.625 2.625 0 010-5.25h5.25zm-2.625 8.875a2.625 2.625 0 01-5.25 0v-5.25a2.625 2.625 0 015.25 0v5.25zM2.417 12h5.25v5.25a2.625 2.625 0 01-5.25 0V12zm16.166 0h5.25a2.625 2.625 0 010 5.25h-5.25V12zm-8.875 2.625a2.625 2.625 0 010-5.25h5.25v5.25a2.625 2.625 0 01-5.25 0v-5.25z"/></svg>`,
  Zoom: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#2D8CFF" d="M20.618 5.549A11.916 11.916 0 0012 2C6.477 2 2 6.477 2 12c0 2.22.727 4.272 1.954 5.938L2 22l4.062-1.954A11.916 11.916 0 0012 22c5.523 0 10-4.477 10-10a11.916 11.916 0 00-1.382-5.451zM12 20c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm4-6H8v-2h8v2zm0-4H8V8h8v2z"/></svg>`,
  Xcode: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#147EFB" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-1 3v2h2V5h-2zm0 4v6h2V9h-2zm0 8v2h2v-2h-2z"/></svg>`,
  iTerm: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v2H7V7zm4 0h6v2h-6V7zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2z"/></svg>`,
  iTerm2: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v2H7V7zm4 0h6v2h-6V7zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2z"/></svg>`,
  Docker: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0DB7ED" d="M2 8h2v2H2V8zm4 0h2v2H6V8zm4 0h2v2h-2V8zm4 0h2v2h-2V8zm4 0h2v2h-2V8zm-8-4h2v2h-2V4zm4 0h2v2h-2V4zm-8 8h2v2H6v-2zm4 0h2v2h-2v-2zm8-8h2v2h-2V4zm-2 12h-2v-2h-2v2h-2v-2H8v2H6v-2H4v2H2v-2H0v4h24v-4h-2v2z"/></svg>`,
  Preview: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M4 2h16v20H4V2zm2 2v16h12V4H6zm4 2h4v4h-4V6zm0 6h4v4h-4v-4zm0 6h4v2h-4v-2z"/></svg>`,
  Calendar: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16H5V8h14v11z"/></svg>`,
  Mail: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  Notes: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 3h-14c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 12h-4v2h4v-2zm-6-4h6v2h-6v-2zm0-4h6v2h-6V7z"/></svg>`,
  Photos: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
  Music: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
  News: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v6H7v-6z"/></svg>`,
  Maps: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>`,
  Messages: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`,
  FaceTime: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M20 2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4v-2H4V4h16v6h2V4c0-1.1-.9-2-2-2zM8 14H6v-2h2v2zm0-4H6V8h2v2zm6 6h-4v-2h4v2zm4-4h-4v-2h4v2zm0-4h-4V6h4v2z"/></svg>`,
  Contacts: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 0H5c-1.1 0-2 .9-2 2v20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm-7 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm6 14H6v-2c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v2z"/></svg>`,
  Reminders: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2z"/></svg>`,
  "Activity Monitor": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v6H7V7zm4 0h2v8h-2V7zm4 0h2v4h-2V7z"/></svg>`,
  "System Preferences": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>`,
  "App Store": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>`,
  TextEdit: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 3h-14c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 12h-4v2h4v-2zm-6-4h6v2h-6v-2zm0-4h6v2h-6V7z"/></svg>`,
  "QuickTime Player": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-11h2v6h-2V9z"/></svg>`,
  "Time Machine": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h4v2h-6V7z"/></svg>`,
  "Disk Utility": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z"/></svg>`,
  "Keychain Access": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h1v2c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2h1c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm0 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z"/></svg>`,
  Notepad: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19 3h-14c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 12h-4v2h4v-2zm-6-4h6v2h-6v-2zm0-4h6v2h-6V7z"/></svg>`,
  "File Explorer": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>`,
  "Task Manager": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v6H7V7zm4 0h2v8h-2V7zm4 0h2v4h-2V7z"/></svg>`,
  PowerShell: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#012456" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v2H7V7zm4 0h6v2h-6V7zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2z"/></svg>`,
  "Command Prompt": `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v2H7V7zm4 0h6v2h-6V7zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2zm-4 4h2v2H7v-2zm4 0h6v2h-6v-2z"/></svg>`,
  Other: `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>`,
};

function getAppIcon(appName) {
  const normalizedAppName = appName.trim();
  const svg = appIconMap[normalizedAppName] || appIconMap["Other"];

  if (appName.includes("node") && appName.includes(".js")) {
    return "/icons/Node.png";
  }
  // Encode the SVG as a data URL
  if (svg.startsWith("<svg")) {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
  return svg;
}

async function getProcessStats() {
  const platform = os.platform();
  try {
    console.log(`Attempting to get process list on ${platform}...`);

    let processes = [];
    if (platform === "darwin") {
      // macOS
      const { stdout } = await execPromise("ps -A -m -o pid,rss,command");
      const lines = stdout.trim().split("\n");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [pid, rss, ...commandParts] = line.split(/\s+/);
        const command = commandParts.join(" ");

        const memory = (parseInt(rss, 10) / 1024).toFixed(2);

        processes.push({
          pid: parseInt(pid, 10),
          memory,
          command,
        });
      }
    } else if (platform === "win32") {
      // Windows
      const { stdout } = await execPromise("tasklist /FO CSV /NH");
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        const [name, pid, , , memory] = line
          .split('","')
          .map((item) => item.replace(/"/g, "").trim());
        if (!name || !pid || !memory) continue;

        const memoryKB = parseInt(memory.replace(/[^0-9]/g, ""), 10);
        const memoryMB = (memoryKB / 1024).toFixed(2);

        processes.push({
          pid: parseInt(pid, 10),
          memory: memoryMB,
          command: name,
        });
      }
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Found ${processes.length} processes`);

    const appGroups = {};
    for (const proc of processes) {
      const { appName, processName } = extractAppName(proc.command, platform);
      if (!appGroups[appName]) {
        appGroups[appName] = {
          processes: [],
          totalMemory: 0,
          icon: getAppIcon(appName),
        };
      }
      appGroups[appName].processes.push({
        pid: proc.pid,
        memory: proc.memory,
        name: processName,
      });
      appGroups[appName].totalMemory += parseFloat(proc.memory);
    }

    const groupedProcesses = Object.entries(appGroups)
      .map(([appName, data]) => ({
        appName,
        totalMemory: data.totalMemory.toFixed(2),
        processes: data.processes,
        icon: data.icon,
      }))
      .sort((a, b) => b.totalMemory - a.totalMemory);

    return groupedProcesses.slice(0, 10);
  } catch (err) {
    console.error("Process stats error:", err.message);

    const memory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    return [
      {
        appName: "Current Process (Fallback)",
        totalMemory: memory,
        processes: [
          {
            pid: process.pid,
            memory,
            name: "Current Process (Fallback)",
          },
        ],
        icon: getAppIcon("Other"),
      },
    ];
  }
}

io.on("connection", async (socket) => {
  console.log("New client connected");

  try {
    socket.emit("memoryUpdate", {
      system: getSystemMemory(),
      processes: await getProcessStats(),
    });
  } catch (err) {
    console.error("Initial data error:", err);
  }

  const interval = setInterval(async () => {
    try {
      const data = {
        system: getSystemMemory(),
        processes: await getProcessStats(),
      };
      socket.emit("memoryUpdate", data);
    } catch (err) {
      console.error("Update error:", err);
    }
  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Platform:", process.platform);
  console.log("PID:", process.pid);
});
