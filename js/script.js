const extpay = ExtPay("color-analysis-shopper");

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

  (r /= 255), (g /= 255), (b /= 255);
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

function calculateDistance(x1, y1, x2, y2) {
  const xDiff = x2 - x1;
  const yDiff = y2 - y1;
  return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

function calculatelength(x, y, a, b, c) {
  const num = Math.abs(x * a + b * y + c);
  const den = Math.sqrt(a ** 2 + b ** 2);
  return num / den;
}

function standardDeviation(arr) {
  const filteredArr = arr.filter((value) => value); // Filters out null and undefined
  if (filteredArr.length === 0) {
    return NaN; // Return NaN if the array is empty after filtering
  }

  const n = filteredArr.length;
  const mean = filteredArr.reduce((a, b) => a + b, 0) / n;
  const variance =
    filteredArr.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function findSeasonOfSmallestValue(dictionary) {
  let smallestValue = Infinity;
  let season = null;

  for (const index in dictionary) {
    if (dictionary.hasOwnProperty(index)) {
      if (dictionary[index] < smallestValue) {
        smallestValue = dictionary[index];
        season = index;
      }
    }
  }
  return season;
}

function getSeasonWithHighestValue(dictionary) {
  let highestValue = -Infinity;
  let season = null;

  for (const index in dictionary) {
    if (dictionary.hasOwnProperty(index)) {
      if (dictionary[index] > highestValue) {
        highestValue = dictionary[index];
        season = index;
      }
    }
  }
  return season;
}

function pickNeutral(seasons_dict, change, neutral_v = 7) {
  for (var [key, value] of Object.entries(seasons_dict)) {
    if (value < change) {
      seasons_dict[key] = change;
    }
  }
  const neutral_type = {
    6: "Pure Neutral",
    5: "Pure Neutral",
    4: "Half Neutral",
    3: "Near Neutral",
  };
  seasons_dict[neutral_type[change]] = neutral_v;
  return seasons_dict;
}

function scalogic(sat, lum) {
  const x = sat;
  const y = lum;

  // summer = high lum, low sat
  // winter = low lum, high sat
  // spring = high lum, high sat
  // autumn = low lum, low sat

  // low s -> soft
  // high s -> bright
  // low l -> dark
  // high l -> light

  // Should make the rating like a circle

  // Saturation is x, lum is y

  // find distance of both x or y equations and pick the smallest distance
  // then use a condition that if it is directly across, we add the distance to the center so we have distance for everything
  const center_dist = calculateDistance(50, 50, x, y);

  const lum_dict = {
    "Light Summer": function (x, y) {
      if ((y <= 0.2679 * x + 36.605) & (x >= (y - 36.605) / 0.2679)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 3.732, 1, -236.607);
      }
    },
    "True Summer": function (x, y) {
      if ((y <= x) & (x >= y)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 1, 1, -100);
      }
    },
    "Soft Summer": function (x, y) {
      if ((y <= 3.732 * x - 136.607) & (x >= (y + 136.607) / 3.732)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 0.2679, 1, -63.395);
      }
    },
    "Bright Spring": function (x, y) {
      if ((y <= -3.732 * x + 236.607) & (x <= (y - 236.607) / -3.732)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -0.2679, 1, -36.605);
      }
    },
    "True Spring": function (x, y) {
      if ((y <= -x + 100) & (x <= -y + 100)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -1, 1, 0);
      }
    },
    "Light Spring": function (x, y) {
      if ((y <= -0.2679 * x + 63.395) & (x <= (y - 63.395) / -0.2679)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -3.732, 1, 136.607);
      }
    },
    "Dark Winter": function (x, y) {
      if ((y > 0.2679 * x + 36.605) & (x < (y - 36.605) / 0.2679)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 3.732, 1, -236.607);
      }
    },
    "True Winter": function (x, y) {
      if ((y > x) & (x < y)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 1, 1, -100);
      }
    },
    "Bright Winter": function (x, y) {
      if ((y > 3.732 * x - 136.607) & (x < (y + 136.607) / 3.732)) {
        return center_dist;
      } else {
        return calculatelength(x, y, 0.2679, 1, -63.395);
      }
    },
    "Soft Autumn": function (x, y) {
      if ((y > -3.732 * x + 236.607) & (x > (y - 236.607) / -3.732)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -0.2679, 1, -36.605);
      }
    },
    "True Autumn": function (x, y) {
      if ((y > -x + 100) & (x > -y + 100)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -1, 1, 0);
      }
    },
    "Dark Autumn": function (x, y) {
      if ((y > -0.2679 * x + 63.395) & (x > (y - 63.395) / -0.2679)) {
        return center_dist;
      } else {
        return calculatelength(x, y, -3.732, 1, 136.607);
      }
    },
  };

  const distance_dict = {
    "Bright Spring": Math.min(lum_dict["Bright Spring"](x, y)),
    "True Spring": Math.min(lum_dict["True Spring"](x, y)),
    "Light Spring": Math.min(lum_dict["Light Spring"](x, y)),
    "Light Summer": Math.min(lum_dict["Light Summer"](x, y)),
    "True Summer": Math.min(lum_dict["True Summer"](x, y)),
    "Soft Summer": Math.min(lum_dict["Soft Summer"](x, y)),
    "Soft Autumn": Math.min(lum_dict["Soft Autumn"](x, y)),
    "True Autumn": Math.min(lum_dict["True Autumn"](x, y)),
    "Dark Autumn": Math.min(lum_dict["Dark Autumn"](x, y)),
    "Dark Winter": Math.min(lum_dict["Dark Winter"](x, y)),
    "True Winter": Math.min(lum_dict["True Winter"](x, y)),
    "Bright Winter": Math.min(lum_dict["Bright Winter"](x, y)),
  };

  const stddev = standardDeviation(Object.values(distance_dict));

  console.log("sat: " + x, "lum: " + y);
  console.log(distance_dict);
  console.log(stddev);

  // lowest+stddev/2 is perfect, lowest+stddev(1.5) is great, lowest+stddev(2.5) is good

  var seasons_dict = {
    "Bright Spring": 1,
    "True Spring": 1,
    "Light Spring": 1,
    "Light Summer": 1,
    "True Summer": 1,
    "Soft Summer": 1,
    "Soft Autumn": 1,
    "True Autumn": 1,
    "Dark Autumn": 1,
    "Dark Winter": 1,
    "True Winter": 1,
    "Bright Winter": 1,
  };

  const season = findSeasonOfSmallestValue(distance_dict);
  seasons_dict[season] = 6;
  const keys = Object.keys(seasons_dict);
  var index = keys.indexOf(season);
  var score = 5;
  for (let i = 1; i < 5; i++) {
    var keydown = keys.at(index - i);
    var height = index + i >= 12 ? 12 : 0;
    var keyup = keys.at(index - height + i);

    seasons_dict[keydown] = score;
    seasons_dict[keyup] = score;
    score -= 1;
  }

  // Neutrals:
  // Near Neutral, Half Nautral, Pure Neutral
  // stage 1 y=5,98  x=4: adds +1 to any 0
  // stage 2 y=4,99  x=3: adds additional +1 to any below 2
  // stage 3 y=3  x=2: adds additional +1 to any below 3
  // stage 4 y=2,1,0,100 and x=0,1: adds additional +1 to any below 4
  var change = 0;
  if (x <= 6 || y <= 5 || y >= 98) {
    if ([0, 1].includes(x) || [100, 0, 1, 2].includes(y)) {
      change = 6;
    } else if ([2, 3].includes(x) || y == 3) {
      change = 5;
    } else if ([4, 5].includes(x) || [4, 99].includes(y)) {
      change = 4;
    } else if (x == 6 || [5, 98].includes(y)) {
      change = 3;
    }
    seasons_dict = pickNeutral(seasons_dict, change);
  } else if ((x <= 10) & (y <= 10 || y >= 93)) {
    change = 4;
    seasons_dict = pickNeutral(seasons_dict, change);
  }
  return seasons_dict;
}

function dropper() {
  const eyeDropper = new EyeDropper();
  const $find = document.querySelector(".find");
  const $infobox = document.querySelector(".infobox");
  const $info = document.querySelectorAll(".info");
  const $season = document.querySelector(".season");
  const $result = document.querySelector(".result");
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

  function showResult(hex = "#FFFFFF") {
    $infobox.style.backgroundColor = hex;
    $scaInfo.style.backgroundColor = hex;
    $hexInfo.innerText = "Color:\n" + hex;
    var hsl = hextohsl(hex);
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
    const ranks = {
      1: "Bad",
      2: "Eh",
      3: "Okay",
      4: "Good",
      5: "Great",
      6: "Perfect",
    };

    var output = scalogic(parseFloat(hsl.s), parseFloat(hsl.l));
    var top_season = getSeasonWithHighestValue(output);
    $scaInfo.innerText = top_season;
    const fit = document.getElementById("picker").value;
    var match = ranks[output[fit]] ? ranks[output[fit]] : "Select a season";
    $season.innerText = "Your match:\n" + match;
    $result.innerText = top_season;
    $softautumn.innerText = ranks[output["Soft Autumn"]];
    $darkwinter.innerText = ranks[output["Dark Winter"]];
    $brightspring.innerText = ranks[output["Bright Spring"]];
    $lightsummer.innerText = ranks[output["Light Summer"]];
    $truautumn.innerText = ranks[output["True Autumn"]];
    $truwinter.innerText = ranks[output["True Winter"]];
    $truspring.innerText = ranks[output["True Spring"]];
    $trusummer.innerText = ranks[output["True Summer"]];
    $darkautumn.innerText = ranks[output["Dark Autumn"]];
    $brightwinter.innerText = ranks[output["Bright Winter"]];
    $lightspring.innerText = ranks[output["Light Spring"]];
    $softsummer.innerText = ranks[output["Soft Summer"]];
  }

  function openDropper() {
    eyeDropper
      .open()
      .then((res) => {
        if (res && res.sRGBHex) {
          showResult(res.sRGBHex);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }

  $find.addEventListener("click", openDropper);
}

function init() {
  if ("EyeDropper" in window) {
    dropper();
  } else {
    showNoSupport();
  }
}
extpay
  .getUser()
  .then((user) => {
    if (user.paid) {
      console.log("1");
      console.log("a");
      init();
    } else if (!user.trialStartedAt && !user.subscriptionStatus) {
      // Have user create trial account
      extpay.openTrialPage("14 day");
      console.log("a");
      document.getElementById("bottom").style.display = "none";
    } else {
      if (
        user.subscriptionStatus == "past_due" ||
        user.subscriptionStatus == "canceled"
      ) {
        console.log("b");
        // Have user pay for extension
        document.getElementById("bottom").style.display = "none";
      } else if (user.trialStartedAt) {
        const now = new Date();
        const twoweeks = 1000 * 60 * 60 * 24 * 14; // in milliseconds
        if (user.trialStartedAt && now - user.trialStartedAt < twoweeks) {
          console.log("c");
          init();
        } else {
          // Have user pay for extension
          console.log("d");
          document.getElementById("bottom").style.display = "none";
        }
      }
    }
  })
  .catch((err) => {
    document.querySelector("p").innerHTML =
      "Error fetching data :( Check that your user id is correct and you're connected to the internet";
  });
