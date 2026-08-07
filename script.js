const API_URL =
  "https://data.cityofnewyork.us/resource/h9gi-nx95.json?$limit=5000&$select=crash_date,crash_time,borough,number_of_persons_injured,contributing_factor_vehicle_1,vehicle_type_code1&$order=crash_date%20DESC,crash_time%20DESC";

const MINIMUM_CRASHES_FOR_RATE = 20;

const statusElement = document.getElementById("status");
const recordCountElement = document.getElementById("recordCount");
const lastUpdatedElement = document.getElementById("lastUpdated");
const refreshButton = document.getElementById("refreshButton");
const leaderUpdateElement = document.getElementById("leaderUpdate");

let collisionCharts = [];
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
  const totalHour = formatHour(leaders.highestTotal.hour);
  const rateHour = formatHour(leaders.highestRate.hour);

  document.getElementById(
    "insightHeadline"
  ).textContent = `${totalHour} had the most injuries. ${rateHour} had the highest injury rate.`;

  document.getElementById(
    "chartCallout"
  ).textContent = `${totalHour} leads in total injuries, while ${rateHour} leads in injuries per 100 crashes. The two measures answer different questions.`;

  document.getElementById("totalInjuriesHour").textContent = totalHour;
  document.getElementById(
    "totalInjuriesDetail"
  ).textContent = `${leaders.highestTotal.totalInjuries} people injured across ${leaders.highestTotal.crashCount} crashes`;

  document.getElementById("injuryRateHour").textContent = rateHour;
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

function createChartOptions(hourlyData, leaderHour, metric) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const hourData = hourlyData[context.dataIndex];

            if (metric === "rate") {
              return `Injuries per 100 crashes: ${hourData.injuryRate.toFixed(2)}`;
            }

            return `Total injuries: ${hourData.totalInjuries}`;
          },
          afterLabel(context) {
            return `Crash count: ${hourlyData[context.dataIndex].crashCount}`;
          },
          footer(context) {
            const hourData = hourlyData[context[0].dataIndex];

            if (
              metric === "rate" &&
              hourData.crashCount < MINIMUM_CRASHES_FOR_RATE
            ) {
              return "Not eligible for the rate leader: fewer than 20 crashes";
            }

            return "";
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          callback(value, index) {
            const showLabel = index % 3 === 0 || index === leaderHour;
            return showLabel ? this.getLabelForValue(value) : "";
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text:
            metric === "rate"
              ? "Injuries per 100 crashes"
              : "Total injuries",
        },
        ticks: {
          precision: metric === "rate" ? 1 : 0,
        },
      },
    },
  };
}

function renderChart(hourlyData, leaders) {
  // Destroying both old charts prevents duplicates after a refresh.
  collisionCharts.forEach((chart) => chart.destroy());

  const hourLabels = hourlyData.map((hourData) => formatHour(hourData.hour));
  const totalLeaderHour = leaders.highestTotal.hour;
  const rateLeaderHour = leaders.highestRate.hour;

  const totalChart = new Chart(document.getElementById("totalInjuriesChart"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Total injuries",
          data: hourlyData.map((hourData) => hourData.totalInjuries),
          backgroundColor: hourlyData.map((hourData) =>
            hourData.hour === totalLeaderHour ? "#2364aa" : "#c8d9ec"
          ),
          borderRadius: 4,
        },
      ],
    },
    options: createChartOptions(hourlyData, totalLeaderHour, "total"),
  });

  const rateChart = new Chart(document.getElementById("injuryRateChart"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Injuries per 100 crashes",
          data: hourlyData.map((hourData) => hourData.injuryRate),
          backgroundColor: hourlyData.map((hourData) => {
            if (hourData.crashCount < MINIMUM_CRASHES_FOR_RATE) {
              return "#d7d7d7";
            }

            return hourData.hour === rateLeaderHour ? "#d94a45" : "#efc3c1";
          }),
          borderRadius: 4,
        },
      ],
    },
    options: createChartOptions(hourlyData, rateLeaderHour, "rate"),
  });

  collisionCharts = [totalChart, rateChart];
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
    renderChart(hourlyData, leaders);
    reportLeaderChange(leaders);

    previousLeaders = leaders;
    document.getElementById("narrativeRecordCount").textContent =
      records.length.toLocaleString();
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
