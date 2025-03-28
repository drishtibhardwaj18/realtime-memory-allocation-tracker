const socket = io();

const elements = {
  total: document.getElementById("total"),
  used: document.getElementById("used"),
  free: document.getElementById("free"),
  appList: document.getElementById("appList"),
  timestamp: document.getElementById("timestamp"),
};

function updateDisplay(data) {
  const updateElement = (element, value) => {
    if (parseFloat(element.textContent) !== parseFloat(value)) {
      element.textContent = value;
      element.classList.add("updated");
      setTimeout(() => element.classList.remove("updated"), 300);
    }
  };

  // Update system stats
  updateElement(elements.total, data.system.total);
  updateElement(elements.used, data.system.used);
  updateElement(elements.free, data.system.free);

  // Update app list
  if (data.processes && data.processes.length > 0) {
    elements.appList.innerHTML = data.processes
      .map(
        (app) => `
            <div class="app-item">
                <div class="app-header">
                    <img style="object-fit:contain;" src="${app.icon}" alt="${
          app.appName
        } icon" class="app-icon">
                    <span class="app-name">${app.appName}</span>
                    <span class="app-memory">${app.totalMemory} MB</span>
                </div>
                <div class="process-sublist">
                    ${app.processes
                      .map(
                        (proc) => `
                        <div class="process-item">
                            <span class="process-name">${proc.name} (PID: ${proc.pid})</span>
                            <span class="process-memory">${proc.memory} MB</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `
      )
      .join("");

    // Add click event listeners for collapsing/expanding
    document.querySelectorAll(".app-header").forEach((header) => {
      header.addEventListener("click", () => {
        const sublist = header.nextElementSibling;
        sublist.classList.toggle("active");
      });
    });
  } else {
    elements.appList.innerHTML = `
            <div class="app-item">
                <div class="app-header">
                    <span class="app-name">No data available</span>
                    <span class="app-memory">0 MB</span>
                </div>
            </div>
        `;
  }

  elements.timestamp.textContent = `Last updated: ${new Date(
    data.system.timestamp
  ).toLocaleTimeString()}`;
}

socket.on("memoryUpdate", (data) => {
  updateDisplay(data);
});

// Initial empty state
elements.appList.innerHTML =
  '<div class="app-item"><div class="app-header"><span class="app-name">Loading...</span></div></div>';
