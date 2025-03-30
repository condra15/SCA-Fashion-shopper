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

    var colorInHSL = 'hsl(' + hue + ', ' + sat + '%, ' + lum + '%)';
    console.log(colorInHSL);
    return {h:hue,s:sat,l:lum};
}

function scalogic(hue, sat, lum) {
    // Percentage Meanings:
    // 0% -  Bad
    // 30% - Not Okay
    // 50% - Okay
    // 65% - Good
    // 80% - Great
    // 100% - Perfect


    // summer = high lum, low sat
    // winter = low lum, high sat
    // spring = high lum, high sat
    // autumn = low lum, low sat

    // Should make the rating like a circle. Goes from 100 in a season and 
    // subseason then decreases by 25 for each subsequent distance. Then
    // add a little extera below for the neutral colors.
    // The percentage will be the highest subseason of that season.
    // Will possible change this system from numbers to ticks or number of circles in the future.
    // 5 ticks being 100 and 1 being 0

    var win = 0;
    var spr = 0;
    var summ = 0;
    var aut = 0;
    var neutral = 0;

    var bright = 0;
    var light = 0;
    var soft = 0;
    var dark = 0;
    var tru = 0;

    if (sat > 50) {
        win += 33.333;
        spr += 33.333;
        if (sat < 56){
            summ += 17;
            aut += 17;
        }
        // bright += 100;
    } else {
        summ += 33.333;
        aut += 33.333;
        if (sat > 44){
            win += 17;
            spr += 17;
        }
        // soft += 100;
    }
    if (lum > 50) {
        summ += 33.333;
        spr += 33.333;
        if (lum < 56){
            win += 17;
            aut += 17;
        }
        // light += 100;
    } else {
        win += 33.333;
        aut += 33.333;
        if (lum > 44){
            summ += 17;
            spr += 17;
        }
        // dark += 100;
    };


    var seasons_ouput = {'winter': win, 'spring':spr, 'summer':summ, 'autumn':aut, 'neutral':neutral};
    var lum_abs = Math.abs(lum-50) - Math.abs(sat-50);
    console.log(lum_abs)
    switch (Object.keys(seasons_ouput).reduce(function(a, b){ return seasons_ouput[a] > seasons_ouput[b] ? a : b })) {
        // 15 is based on a range of -46 to 46 divided into 3 sections for the seasons
        case 'winter':
            win += 33.333;
            if (lum_abs >= 17){
                dark += 100;
                tru += 50;
                bright += 25;
                aut += 33.333;
            } else if (lum_abs <= -17) {
                dark += 25;
                tru += 50;
                bright += 100;
                spr += 33.333;
            } else {
                dark += 50;
                tru += 100;
                bright += 50;
            };
            break;
        case 'spring':
            spr += 33.333;
            if (lum_abs >= 17){
                light += 100;
                tru += 50;
                bright += 25;
                summ += 33.333;
            } else if (lum_abs <= -17) {
                light += 25;
                tru += 50;
                bright += 100;
                win += 33.333;
            } else {
                light += 50;
                tru += 100;
                bright += 50;
            };
            break;
        case 'summer':
            summ += 33.333;
            if (lum_abs >= 17){
                light += 100;
                tru += 50;
                soft += 25;
                spr += 33.333;
            } else if (lum_abs <= -17) {
                light += 25;
                tru += 50;
                soft += 100;
                aut += 33.333;
            } else {
                light += 50;
                tru += 100;
                soft += 50;
            };
            break;
        case 'autumn':
            aut += 33.333;
            if (lum_abs >= 17){
                dark += 100;
                tru += 50;
                soft += 25;
                win += 33.333;
            } else if (lum_abs <= -17) {
                dark += 25;
                tru += 50;
                soft += 100;
                summ += 33.333;
            } else {
                dark += 50;
                tru += 100;
                soft += 50;
                
            };
            break;
        default:
            dark += 0;
            tru += 0;
            soft += 0;
            light += 0;
            bright += 0;
    };
    

    var seasons_ouput = {'winter': Math.ceil(win), 'spring':Math.ceil(spr), 'summer':Math.ceil(summ), 'autumn':Math.ceil(aut), 'neutral':Math.ceil(neutral)};
    var flow_output = {'bright':bright, 'light':light, 'soft':soft, 'dark':dark, 'tru':tru};
    if (sat<5 || lum<5 || lum >95){
        for (var [key, value] of Object.entries(seasons_ouput)) {
            if (value<99) {
                seasons_ouput[key]+=50;
            };
          };
        for (var [key, value] of Object.entries(flow_output)) {
            if (value<99) {
                flow_output[key]+=50;
            };
          };
        seasons_ouput["neutral"] = 101;
    };

    if (Object.values(seasons_ouput).some(el => el > 101)) {
        for (const [key, value] of Object.entries(seasons_ouput)) {
            if (value > 101){
                seasons_ouput[key] = 100
            }
        }
    }

    return {'0':seasons_ouput, '1':flow_output};
};

function dropper() {
    const eyeDropper = new EyeDropper();
    const $btn = document.querySelector('.btn');
    const $table = document.querySelector('.tableId');
    const $infobox = document.querySelector('.infobox');
    const $info = document.querySelectorAll('.info');
    const $hexInfo = document.querySelector('.hex-info');
    const $scaInfo = document.querySelector('.sca-info');
    const $winter = document.querySelector('.winter');
    const $autumn = document.querySelector('.autumn');
    const $spring = document.querySelector('.spring');
    const $summer = document.querySelector('.summer');
    const $bright = document.querySelectorAll('.bright');
    const $light = document.querySelectorAll('.light');
    const $soft = document.querySelectorAll('.soft');
    const $dark = document.querySelectorAll('.dark');
    const $tru = document.querySelectorAll('.tru');
    var all = document.getElementsByTagName("*");

    
    function showResult(hex = '#FFFFFF'){
        $infobox.style.backgroundColor = hex;
        $table.style.backgroundColor = hex;
        $hexInfo.innerText = hex;
        var hsl = hextohsl(hex);
        if (parseFloat(hsl.l) > 40){
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
            // for (const cell of all) {
            //     cell.style.color = "white"
            // }
        }
        var output = scalogic(parseFloat(hsl.h),parseFloat(hsl.s),parseFloat(hsl.l));
        //seasons = output['0'];
        var seasons = Object.fromEntries(
            Object.entries(output['0']).sort(([,a],[,b]) => b-a)
        );
        var top_season = Object.keys(seasons)[0]
        $scaInfo.innerText = top_season
        $winter.innerText = parseFloat(seasons.winter) + '%';
        $summer.innerText = parseFloat(seasons.summer) + '%';
        $autumn.innerText = parseFloat(seasons.autumn) + '%';
        $spring.innerText = parseFloat(seasons.spring) + '%';
        $bright.forEach(element => {
            element.innerText = parseFloat(output['1']['bright']);
        });
        $light.forEach(element => {
            element.innerText = parseFloat(output['1']['light']);
        });
        $soft.forEach(element => {
            element.innerText = parseFloat(output['1']['soft']);
        });
        $dark.forEach(element => {
            element.innerText = parseFloat(output['1']['dark']);
        });
        $tru.forEach(element => {
            element.innerText = '0';
        });

        if (top_season == 'neutral'){
            $tru.forEach(element => {
                element.innerText = '50';
            });
            var second_season = Object.keys(seasons)[1];
            document.querySelector(`.${second_season}true`).innerText = parseFloat(output['1']['tru']);
        } else {
            document.querySelector(`.${top_season}true`).innerText = parseFloat(output['1']['tru']);
        }
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

    $btn.addEventListener('click', openDropper);
}

function init() {
    if ('EyeDropper' in window) {
        dropper();
    } else {
        showNoSupport();
    }
}

init()