function showNoSupport() {
    const $body = document.querySelector('body');
    const $message = document.createElement('p');
    $message.classList.add('error');
    $message.innerHTML = 'Your browser does not support this';
    $body.appendChild($message);
}

function hextohsl (hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);

    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        };
        h /= 6;
    }

    s = s*100;
    var sat = Math.round(s);
    l = l*100;
    var lum = Math.round(l);
    var hue = Math.round(360*h);

    return {h:hue,s:sat,l:lum};
}

function calculateDistance(x1, y1, x2, y2) {
    const xDiff = x2 - x1;
    const yDiff = y2 - y1;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
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

function pickNeutral(seasons_dict,change,neutral_v=6){
    for (var [key, value] of Object.entries(seasons_dict)) {
        if (value<change){
            seasons_dict[key]=change;
        };
    };
    const neutral_type = {
        "5":"Pure Neutral",
        "4":"Pure Neutral",
        "3":"Half Neutral",
        "2":"Near Neutral",
    }
    seasons_dict[neutral_type[change]] = neutral_v
    return seasons_dict
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
    const lum_dict = {
        "Light Summer":function(x,y) {
            if (y>50 & x<=50) {
                return (-3.732*x)+236.607
            }
        },
        "True Summer":function(x,y) {
            if (y>50 & x<=50) {
                return -x+100
            }
        },
        "Soft Summer":function(x,y) {
            if (y>50 & x<=50) {
                return (-0.2679*x)+63.395
            }
        },
        "Bright Spring":function(x,y) {
            if (y>50 & x>50) {
                return (0.2679*x)+36.605
            }
        },
        "True Spring":function(x,y) {
            if (y>50 & x>50) {
                return x
            }
        },
        "Light Spring":function(x,y) {
            if (y>50 & x>50) {
                return (3.732*x)-136.607
            }
        },
        "Dark Winter":function(x,y) {
            if (y<=50 & x>50) {
                return (-3.732*x)+236.607
            }
        },
        "True Winter":function(x,y) {
            if (y<=50 & x>50) {
                return -x+100
            }
        },
        "Bright Winter":function(x,y) {
            if (y<=50 & x>50) {
                return (-0.2679*x)+63.395
            }
        },
        "Soft Autumn":function(x,y) {
            if (y<=50 & x<=50) {
                return (0.2679*x)+36.605
            }
        },
        "True Autumn":function(x,y) {
            if (y<=50 & x<=50) {
                return x
            }
        },
        "Dark Autumn":function(x,y) {
            if (y<=50 & x<=50) {
                return (3.732*x)-136.607
            }
        },
    }
    
    const distance_dict= {
        "Bright Spring":calculateDistance(x,lum_dict["Bright Spring"](x,y),x,y),
        "True Spring":calculateDistance(x,lum_dict["True Spring"](x,y),x,y),
        "Light Spring":calculateDistance(x,lum_dict["Light Spring"](x,y),x,y),
        "Light Summer":calculateDistance(x,lum_dict["Light Summer"](x,y),x,y),
        "True Summer":calculateDistance(x,lum_dict["True Summer"](x,y),x,y),
        "Soft Summer":calculateDistance(x,lum_dict["Soft Summer"](x,y),x,y),
        "Soft Autumn":calculateDistance(x,lum_dict["Soft Autumn"](x,y),x,y),
        "True Autumn":calculateDistance(x,lum_dict["True Autumn"](x,y),x,y),
        "Dark Autumn":calculateDistance(x,lum_dict["Dark Autumn"](x,y),x,y),
        "Dark Winter":calculateDistance(x,lum_dict["Dark Winter"](x,y),x,y),
        "True Winter":calculateDistance(x,lum_dict["True Winter"](x,y),x,y),
        "Bright Winter":calculateDistance(x,lum_dict["Bright Winter"](x,y),x,y),
    };
    var seasons_dict= {
        "Bright Spring":1,
        "True Spring":1,
        "Light Spring":1,
        "Light Summer":1,
        "True Summer":1,
        "Soft Summer":1,
        "Soft Autumn":1,
        "True Autumn":1,
        "Dark Autumn":1,
        "Dark Winter":1,
        "True Winter":1,
        "Bright Winter":1,
    };

    const season = findSeasonOfSmallestValue(distance_dict);
    seasons_dict[season]=5;
    const keys = Object.keys(seasons_dict);
    var index = keys.indexOf(season);
    var score = 4;
    for (let i=1; i<4; i++){
        var keydown = keys.at(index-i);
        var height = index+i>=12 ? 12:0;
        var keyup = keys.at(index-height+i);

        seasons_dict[keydown]= score;
        seasons_dict[keyup]= score;
        score-=1;
    }


    // Neutrals:
    // Near Neutral, Half Nautral, Pure Neutral
    // stage 1 y=5,98  x=4: adds +1 to any 0
    // stage 2 y=4,99  x=3: adds additional +1 to any below 2
    // stage 3 y=3  x=2: adds additional +1 to any below 3
    // stage 4 y=2,1,0,100 and x=0,1: adds additional +1 to any below 4
    var change = 0;
    if (x<=6 || y<=5 || y>=98){
        if (([0,1].includes(x)) || ([100,0,1,2].includes(y))){
            change = 5;
        } else if (([2,3].includes(x)) || (y==3)){
            change = 4;
        } else if (([4,5].includes(x)) || ([4,99].includes(y))){
            change = 3;
        } else if (x <=10 & (y<=10 || y >=96)){
            change = 3;
        } else if ((x==6) || ([5,98].includes(y))){
            change = 2;
        }
        seasons_dict = pickNeutral(seasons_dict, change)
    };
    return seasons_dict;
};

function dropper() {
    const eyeDropper = new EyeDropper();
    const $find = document.querySelector('.find');
    const $infobox = document.querySelector('.infobox');
    const $info = document.querySelectorAll('.info');
    const $season = document.querySelector('.season');
    const $hexInfo = document.querySelector('.hex');
    const $scaInfo = document.querySelector('.sca-info');
    const $softautumn = document.querySelector('.softautumn');
    const $darkwinter = document.querySelector('.darkwinter');
    const $brightspring = document.querySelector('.brightspring');
    const $lightsummer = document.querySelector('.lightsummer');
    const $truautumn = document.querySelector('.truautumn');
    const $truwinter = document.querySelector('.truwinter');
    const $truspring = document.querySelector('.truspring');
    const $trusummer = document.querySelector('.trusummer');
    const $darkautumn = document.querySelector('.darkautumn');
    const $brightwinter = document.querySelector('.brightwinter');
    const $lightspring = document.querySelector('.lightspring');
    const $softsummer = document.querySelector('.softsummer');
    
    function showResult(hex = '#FFFFFF'){
        $infobox.style.backgroundColor = hex;
        $scaInfo.style.backgroundColor = hex;
        $hexInfo.innerText = "Color:\n" + hex;
        var hsl = hextohsl(hex);
        if (parseFloat(hsl.l) > 45){
            $hexInfo.style.color = "black";
            $scaInfo.style.color = "black";
            $info.forEach(element => {
                element.style.color = "black";
            });
        } else {
            $hexInfo.style.color = "white";
            $scaInfo.style.color = "white";
            $info.forEach(element => {
                element.style.color = "white";
            });
        };
        const ranks = {
            "1": "Bad",
            "2": "Okay",
            "3": "Good",
            "4": "Great",
            "5": "Perfect"
        };

        var output = scalogic(parseFloat(hsl.s),parseFloat(hsl.l));
        var top_season = getSeasonWithHighestValue(output);
        $scaInfo.innerText = "This is\n"+top_season;
        const fit = document.getElementById("picker").value
        var match = ranks[output[fit]] ? ranks[output[fit]]:"Select a season"
        $season.innerText = "Your match:\n"+match;
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
    };

    function openDropper() {
        eyeDropper.open()
            .then(res => {
                if (res && res.sRGBHex) {
                    showResult(res.sRGBHex);
                }
            })
            .catch(err => {
                console.error(err);
            });
    }

    $find.addEventListener('click', openDropper);
}

function init() {
    if ('EyeDropper' in window) {
        dropper();
    } else {
        showNoSupport();
    }
}

init()
