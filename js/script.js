const extpay = ExtPay("color-analysis-shopper");

// Constants for daily counter
const MAX_CLICKS = 5;
const MAX_HOURS = 24;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let isPaidUser = false;

async function loadState() {
  const now = Date.now();
  const { counter = MAX_CLICKS, lastReset = now } =
    await chrome.storage.local.get(["counter", "lastReset"]);

  if (now - lastReset >= ONE_DAY_MS) {
    await chrome.storage.local.set({ counter: MAX_CLICKS, lastReset: now });
    return { counter: MAX_CLICKS };
  }

  const nextReset = lastReset + ONE_DAY_MS;
  const timeLeftMs = nextReset - now;
  const hoursLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60));
  const $resetTimer = document.getElementById("reset-timer");
  if ($resetTimer) {
    $resetTimer.textContent = `Resets in: ${hoursLeft} hour${
      hoursLeft !== 1 ? "s" : ""
    }`;
  }

  return [counter, hoursLeft];
}

async function getSeasonFromHex(hexColor, userS) {
  if (typeof hexColor !== "string" || typeof userS !== "string") {
    console.error("Invalid input: hexColor and userSeason must be strings.");
    return null;
  }
  // const url =
  //   "https://color-season-finder.p.rapidapi.com/api/seasonal-color-hex";
  const url = "https://cleo-api-toq2.onrender.com/api/seasonal-color-hex";

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hex: hexColor,
      userSeason: userS,
    }),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Error fetching season:", error);
    return null;
  }
}

function showNoSupport() {
  const $body = document.querySelector("container");
  const $message = document.createElement("p");
  $message.classList.add("error");
  $message.innerHTML = "Your browser does not support this extension";
  $body.appendChild($message);
}

function hextohsl(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);

  ((r /= 255), (g /= 255), (b /= 255));
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h,
    s,
    l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  s = s * 100;
  var sat = Math.round(s);
  l = l * 100;
  var lum = Math.round(l);
  var hue = Math.round(360 * h);
  return { h: hue, s: sat, l: lum };
}

function dropper() {
  const $find = document.querySelector(".find");
  const $infobox = document.querySelector(".infobox");
  const $info = document.querySelectorAll(".info");
  const $season = document.querySelector(".season");
  const $result = document.querySelector(".result");
  const $dropdown = document.getElementById("picker");
  const $hexInfo = document.querySelector(".hex");
  const $scaInfo = document.querySelector(".sca-info");
  const $softautumn = document.querySelector(".softautumn");
  const $darkwinter = document.querySelector(".darkwinter");
  const $brightspring = document.querySelector(".brightspring");
  const $lightsummer = document.querySelector(".lightsummer");
  const $truautumn = document.querySelector(".truautumn");
  const $truwinter = document.querySelector(".truwinter");
  const $truspring = document.querySelector(".truspring");
  const $trusummer = document.querySelector(".trusummer");
  const $darkautumn = document.querySelector(".darkautumn");
  const $brightwinter = document.querySelector(".brightwinter");
  const $lightspring = document.querySelector(".lightspring");
  const $softsummer = document.querySelector(".softsummer");

  async function updateCounter(newCount) {
    $find.disabled = newCount === 0;
    await chrome.storage.local.set({ counter: newCount });
  }

  async function openDropper() {
    if (!isPaidUser) {
      const { counter } = await chrome.storage.local.get("counter");
      if (counter <= 0) {
        console.log("Daily use limit reached.");
        return;
      }
    }

    const eyeDropper = new EyeDropper();
    try {
      const res = await eyeDropper.open();
      if (res && res.sRGBHex) {
        showResult(res.sRGBHex);
        if (!isPaidUser) {
          const { counter } = await chrome.storage.local.get("counter");
          const newCount = counter - 1;
          document.getElementById("count").innerHTML =
            "Daily usage count remaining: " + newCount;
          await updateCounter(newCount);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!isPaidUser) {
      const [counter, hoursLeft] = await loadState();
      $find.disabled = counter <= 0;
    }
  });

  chrome.storage.local.get(["dropdownValue"], function (result) {
    if (result.dropdownValue) {
      const $dropdown = document.getElementById("picker");
      $dropdown.value = result.dropdownValue;
      console.log("Dropdown value retrieved: " + result.dropdownValue);
    }
  });

  async function showResult(hex = "#FFFFFF") {
    var hsl = hextohsl(hex);
    var fit = $dropdown.value ? $dropdown.value : undefined;
    var output = await getSeasonFromHex(hex, fit);
    $infobox.style.backgroundColor = hex;
    $scaInfo.style.backgroundColor = hex;
    $hexInfo.innerText = "Color:\n" + hex;

    if (parseFloat(hsl.l) > 50) {
      $hexInfo.style.color = "black";
      $scaInfo.style.color = "black";
      $info.forEach((element) => {
        element.style.color = "black";
      });
    } else {
      $hexInfo.style.color = "white";
      $scaInfo.style.color = "white";
      $info.forEach((element) => {
        element.style.color = "white";
      });
    }

    var top_season = output["colorSeason"];
    $scaInfo.innerText = top_season;
    var match = output["compatibility"]
      ? output["compatibility"]
      : "Select a season";
    $season.innerText = "Your match:\n" + match;
    $result.innerText = top_season;
    $softautumn.innerText = output["seasons_dict"]["Soft Autumn"];
    $darkwinter.innerText = output["seasons_dict"]["Dark Winter"];
    $brightspring.innerText = output["seasons_dict"]["Bright Spring"];
    $lightsummer.innerText = output["seasons_dict"]["Light Summer"];
    $truautumn.innerText = output["seasons_dict"]["True Autumn"];
    $truwinter.innerText = output["seasons_dict"]["True Winter"];
    $truspring.innerText = output["seasons_dict"]["True Spring"];
    $trusummer.innerText = output["seasons_dict"]["True Summer"];
    $darkautumn.innerText = output["seasons_dict"]["Dark Autumn"];
    $brightwinter.innerText = output["seasons_dict"]["Bright Winter"];
    $lightspring.innerText = output["seasons_dict"]["Light Spring"];
    $softsummer.innerText = output["seasons_dict"]["Soft Summer"];
  }

  $find.addEventListener("click", openDropper);
  $dropdown.addEventListener("change", function () {
    const selectedValue = $dropdown.value;
    chrome.storage.local.set({ dropdownValue: selectedValue }, function () {
      console.log("Dropdown value saved: " + selectedValue);
    });
  });
}

async function init() {
  if ("EyeDropper" in window) {
    const now = Date.now();
    const { counter, lastReset } = await chrome.storage.local.get([
      "counter",
      "lastReset",
    ]);

    if (typeof counter !== "number" || typeof lastReset !== "number") {
      await chrome.storage.local.set({
        counter: MAX_CLICKS,
        lastReset: now,
      });
    }
    dropper();
  } else {
    showNoSupport();
  }
}
extpay
  .getUser()
  .then(async (user) => {
    isPaidUser = user.paid;
    let [counter, hoursLeft] = await loadState();
    if (user.paid) {
      init();
    } else if (!user.trialStartedAt && !user.subscriptionStatus) {
      // Have user create trial account
      extpay.openTrialPage("14 day");
      document.getElementById("bottom").textContent =
        "A 2 week free trial page pop-up has automatically opened up. Simply sign up with your email there to unlock access or click Account above to create a permanent account with us";
    } else {
      if (
        user.subscriptionStatus == "past_due" ||
        user.subscriptionStatus == "canceled"
      ) {
        // Have user pay for extension
        document.getElementById("count").hidden = false;
        document.getElementById("reset-timer").hidden = false;
        if (counter <= 0) {
          document.getElementById("bottom").textContent =
            "Daily limit reached. Please register for the extension in the Account section above to unlock infinite uses";
          document.getElementById("reset-timer").textContent =
            `Resets in: ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`;
        } else {
          init();
        }
      } else if (user.trialStartedAt) {
        const now = new Date();
        const twoweeks = 1000 * 60 * 60 * 24 * 14; // in milliseconds
        if (user.trialStartedAt && now - user.trialStartedAt < twoweeks) {
          init();
        } else {
          // Have user pay for extension
          document.getElementById("count").hidden = false;
          document.getElementById("reset-timer").hidden = false;
          if (counter <= 0) {
            document.getElementById("bottom").textContent =
              "Daily limit reached. Please register for the extension in the Account section above to unlock infinite uses";
            document.getElementById("reset-timer").textContent =
              `Resets in: ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`;
          } else {
            init();
          }
        }
      } else {
        document.getElementById("bottom").textContent =
          "Daily limit reached. Please register for the extension in the Account section above to unlock infinite uses";
      }
    }
  })
  .catch((err) => {
    document.querySelector("p").innerHTML =
      "Error fetching data :( Check that your user id is correct and you're connected to the internet";
  });
