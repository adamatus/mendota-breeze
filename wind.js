/* jshint undef: true, unused: true */
/* global d3, moment, $, location, console, window */

// Generic helper functions
var mean = function(a) {
  var sum = 0;
  for (var i = 0; i < a.length; i++){
    sum += a[i];
  }

  return sum/a.length;
};

var rad2deg = function(angle) {
  return angle * (180 / Math.PI);
};

var deg2rad = function(angle) {
  return angle * (Math.PI / 180);
};

var circ_mean = function(a) {
  var sins = a.map(function(d) { return Math.sin(deg2rad(d)); });
  var coss = a.map(function(d) { return Math.cos(deg2rad(d)); });
  var out = rad2deg(Math.atan2(mean(sins), mean(coss)));
  return out > 0 ? out : out + 360;
};

var get_5_num_summary = function(a) {
  var arr = a.slice(0);
  arr.sort(d3.ascending);
  var out = [arr[0],
         d3.quantile(arr,0.75),
         d3.median(arr),
         d3.quantile(arr,0.25),
         arr[arr.length-1],
  ];
  return out;
};

var summary_data = [];

var win_size = 15,
    win_num = 60*3/win_size;

var compute_summaries = function() {
  var out = [];
  var size = ascii.length/win_num;
  var starts = d3.range(0, ascii.length, size);

  var get_speed = function(d) { return d.wind_speed; };
  var get_dir = function(d) { return (d.wind_direction + 180) % 360; };

  var filt_by_dir = function(d,i) {
      return spd[i] > 2;
  };

  for (var i = 0; i < starts.length; i++) {
    var b = ascii.slice(starts[i],starts[i]+size);
    var spd = b.map(get_speed);
    var out_tmp = {};
    var tmp = get_5_num_summary(spd);
    out_tmp.speed = tmp.slice(0);

    var dir = b.map(get_dir);
    var filt_dir = dir.filter(filt_by_dir);
    out_tmp.all_dirs = filt_dir;
    out_tmp.dir_mean = circ_mean(filt_dir);
    out.push(out_tmp);
  }
  summary_data = out;
};

// This project specific helper functions

var meters_per_sec2knots = function(d) {
  return d * 1.94384;
};

var yql_json2ascii = function(d) {
  var myascii = [];
  var out = {};
  for (var i = 0; i < d.data.length; i++) {
    var time = moment(d.stamps[i]).subtract('hours',6).format('YYYY-MM-DD HH:mm:ss');
    out = {stamp: format.parse(time)};
    for (var j = 0; j < d.symbols.length; j++) {
      out[d.symbols[j]] = +d.data[i].json[j];
      out.wind_speed = meters_per_sec2knots(out.wind_speed);
    }
    myascii.push(out);
  }
  return myascii;
};

// Global plot variables

var padding = 40,
    width = 1100,
    height = 450;

var margins = [100, 200, 50, 200],
    mb = margins[0],
    ml = margins[1],
    mt = margins[2],
    mr = margins[3],
    w = width - (ml + mr),
    h = height - (mb + mt);

var time_scale = d3.time.scale()
  .range([0, w]);

var speed_scale = d3.scale.linear()
  .domain([0,30])
  .rangeRound([h, 0]);

var summary_x = d3.scale.linear()
  .domain([0,win_num])
  .range([0, w]);

var timeAxis = d3.svg.axis().scale(time_scale).orient("bottom");
var yAxisSpeed = d3.svg.axis().scale(speed_scale).orient("left")
      .innerTickSize(-w);

var format = d3.time.format("%Y-%m-%d %X");
var ascii = [];

var update_timescale = function () {
  time_scale.domain(d3.extent(ascii.map(function(d) { return d.stamp;})));
  d3.select('.x.axis').transition().call(timeAxis);
};


// Summary plot specific code
var draw_summary = function() {
  var windchart = d3.select("#wind-summary")
      .append("svg:svg")
      .attr('id','wind-summary')
      .attr("width", width)
      .attr("height", height+padding);

  var plot = windchart.append('g')
    .attr('id','plot')
    .attr('transform','translate('+ml+','+mt+')');


  // Add y-axis
  var y_axis_speed = plot.append("g")
    .attr("class", "y axis");
  y_axis_speed.append('svg:text')
    .text('Wind Speed')
    .attr('transform','translate(-100,'+speed_scale(15)+')');
  y_axis_speed.append('svg:text')
    .text('(knots)')
    .attr('transform','translate(-100,'+speed_scale(13)+')');
  y_axis_speed.append('svg:text')
    .text('Wind Direction')
    .attr('transform','translate(-100,'+(h+60)+')');
  y_axis_speed.call(yAxisSpeed);

  var time_axis = plot.append("g")
  .attr("class", "x axis")
    .attr('transform','translate(0,'+h+')');
  time_axis.append('svg:text')
    .text('Last 3 Hours')
    .attr('transform','translate('+(w/2)+',100)');
  time_axis.call(timeAxis);

  plot.append('g')
    .attr('class','plot-group');

};


var pad_x = function(d,i) {
    if (i === 0) {
      return summary_x(0);
    } else if (i === (summary_data.length-1)) {
      return summary_x(i+1);
    } else {
      return summary_x(i+0.5);
    }
};

var speed_mean = d3.svg.line()
  .interpolate('monotone')
  .x(pad_x)
  .y(function(d) { return speed_scale(d.speed[2]); });

var speed_extremes = d3.svg.area()
  .interpolate('monotone')
  .x(pad_x)
  .y0(function(d) { return speed_scale(d.speed[0]); })
  .y1(function(d) { return speed_scale(d.speed[4]); });

var speed_quartiles = d3.svg.area()
  .interpolate('monotone')
  .x(pad_x)
  .y0(function(d) { return speed_scale(d.speed[1]); })
  .y1(function(d) { return speed_scale(d.speed[3]); });

var add_summary_ribbons = function() {
  var ribbon_group = d3.select('#wind-summary g.plot-group')
      .append('svg:g')
      .attr('class','ribbon-group');

  ribbon_group.append('svg:path')
      .style('fill','#deebf7')
      .style('opacity','.8')
      .attr('d', speed_extremes(summary_data));

  ribbon_group.append('svg:path')
      .style('fill','#9ecae1')
      .style('opacity','.8')
      .attr('d', speed_quartiles(summary_data));

  ribbon_group.append('svg:path')
      .style('stroke','#3182bd')
      .style('opacity','.8')
      .style('stroke-width','2px')
      .attr('d', speed_mean(summary_data));
};

var add_overlapping_dir_arrows = function() {
  var arrow_groups = d3.select('#wind-summary g.plot-group').selectAll('.arrow-group')
      .data(summary_data)
    .enter().append('svg:g')
      .attr('class','arrow-group')
      .attr('transform',function(d,i) {
        return 'translate('+summary_x(i+0.5)+','+(h+54)+')';
      });

  arrow_groups.selectAll('line.arrows')
      .data(function(d) {
        console.log(d);
        return d.all_dirs;
      })
    .enter().append('svg:line')
      .attr('class','arrows')
      .attr('x1',0)
      .attr('x2',function(d) { return 25*Math.sin(deg2rad(d)); })
      .attr('y1',0)
      .attr('y2',function(d) { return -25*Math.cos(deg2rad(d)); });

  // Mean direction line
  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','3px')
      .attr('x1',0)
      .attr('x2',function(d) { return 25*Math.sin(deg2rad(d.dir_mean)); })
      .attr('y1',0)
      .attr('y2',function(d) { return -25*Math.cos(deg2rad(d.dir_mean)); });

  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','3px')
      .attr('x1',function(d) { return 18*Math.sin(deg2rad(d.dir_mean-20)); })
      .attr('x2',function(d) { return 25*Math.sin(deg2rad(d.dir_mean)); })
      .attr('y1',function(d) { return -18*Math.cos(deg2rad(d.dir_mean-20)); })
      .attr('y2',function(d) { return -25*Math.cos(deg2rad(d.dir_mean)); });

  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','3px')
      .attr('x1',function(d) { return 18*Math.sin(deg2rad(d.dir_mean+20)); })
      .attr('x2',function(d) { return 25*Math.sin(deg2rad(d.dir_mean)); })
      .attr('y1',function(d) { return -18*Math.cos(deg2rad(d.dir_mean+20)); })
      .attr('y2',function(d) { return -25*Math.cos(deg2rad(d.dir_mean)); });
};

// Initial callback on data pull
var draw_plots = function() {

  draw_summary();
  update_timescale();
  compute_summaries();
  add_summary_ribbons();
  add_overlapping_dir_arrows();
};

var pull_local = function() {
  d3.csv('ascii.txt', function(d) {
    return {
      stamp: format.parse(d['YYYY-MM-DD'] + ' ' + d['hh:mm:ss']),
      //air_temp: +d.air_temp,
      wind_direction: +d.wind_direction,
      wind_speed: +d.wind_speed,
      //pressure: +d.pressure
    };
  }, function(error, rows) {
    ascii = rows;
    draw_plots();
  });
};

var pull_last_3_hours = function() {
  var begin_time = moment().utc().subtract('hours',3).format('YYYY-MM-DD%20HH:mm:ss');
  var end_time = moment().utc().format('YYYY-MM-DD%20HH:mm:ss');

  pull_tower(begin_time, end_time);
};

// May also use: http://whateverorigin.org/
var pull_tower = function(begin_time, end_time) {
  var url = 'http://metobs.ssec.wisc.edu/app/rig/tower/data/json?';
  var begin = 'begin='+begin_time;
  var end = '&end='+end_time;
  var symbols = '&symbols=dir:spd:&separator=,&interval=00:00:05';

  var full_url = url+begin+end+symbols;

  $.getJSON("http://query.yahooapis.com/v1/public/yql",
    {
      q:      "select * from json where url=\""+full_url+"\"",
      format: "json"
    },
    function(data){
      if (data.query.results) {
        ascii = yql_json2ascii(data.query.results.json);
        draw_plots();
      } else {
        console.log('Did not get results!');
      }
    }
  );
};

function getQueryVariable(variable)
{
       var query = window.location.search.substring(1);
       var vars = query.split("&");
       for (var i=0;i<vars.length;i++) {
                      var pair = vars[i].split("=");
                      if(pair[0] == variable){return pair[1];}
              }
       return(null);
}

if (location.hash === "#debug") {
  console.log('Using local data...');
  pull_local();
} else {
  var start = getQueryVariable('start');
  var end = getQueryVariable('end');

  if ((start !== null) && (end !== null)) {
    console.log('Pull historical data...');

    var begin_time = moment(start, 'YYYY-MM-DD%20HH:mm:ss');
    var end_time = moment(end, 'YYYY-MM-DD%20HH:mm:ss');
    begin_time = begin_time.utc().format('YYYY-MM-DD%20HH:mm:ss');
    end_time = end_time.utc().format('YYYY-MM-DD%20HH:mm:ss');

    pull_tower(begin_time, end_time);
  } else {
    console.log('Pull last 3 hours...');
    pull_last_3_hours();
  }
}
