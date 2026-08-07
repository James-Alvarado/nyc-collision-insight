const API_URL =
  "https://data.cityofnewyork.us/resource/h9gi-nx95.json?$limit=5000&$select=crash_date,crash_time,borough,number_of_persons_injured,contributing_factor_vehicle_1,vehicle_type_code1&$order=crash_date%20DESC,crash_time%20DESC";

const MINIMUM_CRASHES_FOR_RATE = 20;

const statusElement = document.getElementById("status");
const recordCountElement = document.getElementById("recordCount");
const lastUpdatedElement = document.getElementById("lastUpdated");
const refreshButton = document.getElementById("refreshButton");
const leaderUpdateElement = document.getElementById("leaderUpdate");

let collisionChart = null;
let previousLeaders = null;

async function fetchCollisionData() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`The API returned status ${response.status}.`);
  }

  return response.json();
}

function analyzeByHour(records) {
  // Starting with all 24 hours ensures the chart never skips an hour.
  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    crashCount: 0,
    totalInjuries: 0,
    injuryRate: 0,
  }));

  records.forEach((record) => {
    const hour = Number.parseInt(record.crash_time?.split(":")[0], 10);
    const injuries = Number(record.number_of_persons_injured) || 0;

    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      hourlyData[hour].crashCount += 1;
      hourlyData[hour].totalInjuries += injuries;
    }
  });

  hourlyData.forEach((hourData) => {
    if (hourData.crashCount > 0) {
      hourData.injuryRate =
        (hourData.totalInjuries / hourData.crashCount) * 100;
    }
  });

  return hourlyData;
}

function findLeaders(hourlyData) {
  const highestTotal = hourlyData.reduce((leader, current) =>
    current.totalInjuries > leader.totalInjuries ? current : leader
  );

  // A minimum sample size keeps a very quiet hour from winning too easily.
  const rateCandidates = hourlyData.filter(
    (hourData) => hourData.crashCount >= MINIMUM_CRASHES_FOR_RATE
  );

  const highestRate = rateCandidates.reduce((leader, current) =>
    current.injuryRate > leader.injuryRate ? current : leader
  );

  return { highestTotal, highestRate };
}

function formatHour(hour) {
  const date = new Date(2000, 0, 1, hour);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
  }).format(date);
}

function updateSummary(leaders) {
  document.getElementById("totalInjuriesHour").textContent = formatHour(
    leaders.highestTotal.hour
  );
  document.getElementById(
    "totalInjuriesDetail"
  ).textContent = `${leaders.highestTotal.totalInjuries} people injured across ${leaders.highestTotal.crashCount} crashes`;

  document.getElementById("injuryRateHour").textContent = formatHour(
    leaders.highestRate.hour
  );
  document.getElementById(
    "injuryRateDetail"
  ).textContent = `${leaders.highestRate.injuryRate.toFixed(2)} injuries per 100 crashes`;
}

function reportLeaderChange(newLeaders) {
  if (previousLeaders === null) {
    leaderUpdateElement.textContent =
      "These are the leaders from the first live-data check.";
    return;
  }

  const totalChanged =
    previousLeaders.highestTotal.hour !== newLeaders.highestTotal.hour;
  const rateChanged =
    previousLeaders.highestRate.hour !== newLeaders.highestRate.hour;

  if (!totalChanged && !rateChanged) {
    leaderUpdateElement.textContent =
      "After refreshing, both leading hours stayed the same.";
    return;
  }

  const changedLeaders = [];

  if (totalChanged) {
    changedLeaders.push("the highest-total-injuries hour");
  }

  if (rateChanged) {
    changedLeaders.push("the highest-injury-rate hour");
  }

  leaderUpdateElement.textContent = `After refreshing, ${changedLeaders.join(
    " and "
  )} changed.`;
}

function renderChart(hourlyData) {
  const chartCanvas = document.getElementById("injuryChart");

  // Destroying the old chart prevents duplicate charts after a refresh.
  if (collisionChart !== null) {
    collisionChart.destroy();
  }

  collisionChart = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels: hourlyData.map((hourData) => formatHour(hourData.hour)),
      datasets: [
        {
          label: "Total injuries",
          data: hourlyData.map((hourData) => hourData.totalInjuries),
          backgroundColor: "rgba(35, 100, 170, 0.82)",
          borderColor: "#2364aa",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "injuriesAxis",
        },
        {
          label: "Injuries per 100 crashes",
          data: hourlyData.map((hourData) => hourData.injuryRate),
          backgroundColor: "rgba(217, 119, 6, 0.78)",
          borderColor: "#d97706",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "rateAxis",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              const formattedValue =
                context.dataset.yAxisID === "rateAxis"
                  ? value.toFixed(2)
                  : value;
              return `${context.dataset.label}: ${formattedValue}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Crash hour",
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
        injuriesAxis: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: "Total injuries",
            color: "#2364aa",
          },
          ticks: {
            precision: 0,
          },
        },
        rateAxis: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: "Injuries per 100 crashes",
            color: "#d97706",
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

async function loadDashboard() {
  statusElement.textContent = "Loading live data...";
  statusElement.className = "status";
  refreshButton.disabled = true;
  refreshButton.textContent = "Loading...";

  try {
    const records = await fetchCollisionData();
    const hourlyData = analyzeByHour(records);
    const leaders = findLeaders(hourlyData);

    updateSummary(leaders);
    renderChart(hourlyData);
    reportLeaderChange(leaders);

    previousLeaders = leaders;
    recordCountElement.textContent = `Records returned: ${records.length.toLocaleString()}`;
    lastUpdatedElement.textContent = `Last fetched: ${new Date().toLocaleString()}`;
    statusElement.textContent = "Live collision data loaded successfully.";
    statusElement.className = "status status--success";
  } catch (error) {
    console.error("Collision data could not be loaded:", error);
    statusElement.textContent =
      "We could not load live collision data. Check your connection and try again.";
    statusElement.className = "status status--error";
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh Live Data";
  }
}

refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
