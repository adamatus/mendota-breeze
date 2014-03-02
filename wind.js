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

var rolling_stat = function(o, col, stat, win_length, center) {
  if(typeof(win_length)==='undefined') win_length = 12;
  if(typeof(center)==='undefined') center = true;

  if (win_length > 1) {
    var out = [];

    var return_col = function(d) { return d[col]; };
    for (i = 0; i < (o.length-win_length+1); i++) {
      var a = o.slice(i,i+win_length).map(return_col);
      var stamp_loc = [];
      if (center & win_length > 1) {
        stamp_loc = i + Math.round(win_length/2);
      } else {
        stamp_loc = i + win_length-1;
      }
      var tmp_out = {stamp: o[stamp_loc].stamp};
      tmp_out[col] = stat(a);
      out.push(tmp_out);
    }
    return out;
  }
  return o;
};

var rolling_mean = function(o, col, win_length) {
  return rolling_stat(o,col,mean,win_length);
};

var rolling_circmean = function(o, col, win_length) {
  return rolling_stat(o,col,circ_mean,win_length);
};

var get_5_num_summary = function(a) {
  a.sort(d3.ascending);
  out = {};
  out.spd_min = d3.min(a);
  out.spd_first = d3.quantile(a,0.25);
  out.spd_half = d3.median(a);
  out.spd_third = d3.quantile(a,0.75);
  out.spd_max = d3.max(a);
  return out;
};

var get_circ_5_num_summary = function(a) {
  // FIXME Need to compute proper min/max/first/third
  a.sort(d3.ascending);
  out = {};
  out.dir_half = circ_mean(a);
  out.dir_min = -20;
  out.dir_max = 20;
  out.dir_first = -10;
  out.dir_third = 10;

  return out;
};

// This project specific helper functions

var json2ascii = function(d) {
  var myascii = [];
  out = {};
  for (var i = 0; i < d.data.length; i++) {
    out = {stamp: format.parse(d.stamps[i])};
    for (var j = 0; j < d.symbols.length; j++) {
      out[d.symbols[j]] = d.data[i][j];
    }

    myascii.push(out);
  }
  return myascii;
};

var meters_per_sec2knots = function(d) {
  return d * 1.94384;
};

var yql_json2ascii = function(d) {
  var myascii = [];
  out = {};
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
    height = 450,
    started = false;

var margins = [100, 200, 50, 200],
    mb = margins[0],
    ml = margins[1],
    mt = margins[2],
    mr = margins[3],
    w = width - (ml + mr),
    h = height - (mb + mt);

var x = d3.scale.linear()
  .domain([0,2160])
  .range([0, w]);

var time_scale = d3.time.scale()
  .range([0, w]);

var speed_scale = d3.scale.linear()
  .domain([0,30])
  .rangeRound([h, 0]);

var dir_scale = d3.scale.linear()
  .domain([0,360])
  .rangeRound([h, 0]);

var summary_x = d3.scale.linear()
  .domain([0,12])
  .range([0, w]);

var xAxis = d3.svg.axis().scale(x).orient("top");
var timeAxis = d3.svg.axis().scale(time_scale).orient("bottom");
var yAxisSpeed = d3.svg.axis().scale(speed_scale).orient("left");
var yAxisDir = d3.svg.axis().scale(dir_scale).tickValues([0,45,90,135,180,225,270,315,360]).orient("right");

var format = d3.time.format("%Y-%m-%d %X");
var ascii = [];

// Full timeseries specific code
var speed_line = d3.svg.line()
  .interpolate('monotone')
  .x(function(d,i) { return time_scale(d.stamp); })
  .y(function(d) { return speed_scale(d.wind_speed); });

var dir_line = d3.svg.line()
  .interpolate('monotone')
  .x(function(d,i) { return time_scale(d.stamp); })
  .y(function(d) { return dir_scale(d.wind_direction); });

var draw_timeseries = function() {
  var windchart = d3.select("#wind-chart")
      .append("svg:svg")
      .attr('id','wind-chart')
      .attr("width", width)
      .attr("height", height+padding);

  var plot = windchart.append('g')
    .attr('id','plot')
    .attr('transform','translate('+ml+','+mt+')');

  var time_axis = plot.append("g")
  .attr("class", "x axis")
    .attr('transform','translate(0,'+h+')');
  time_axis.append('svg:text')
    .text('Last 3 Hours')
    .attr('transform','translate('+(w/2)+',80)');
  time_axis.call(timeAxis);

  // Add y-axis
  var y_axis_speed = plot.append("g")
    .attr("class", "y axis");
  y_axis_speed.append('svg:text')
    .text('Wind Speed')
    .attr('transform','translate(-100,'+speed_scale(18)+')');
  y_axis_speed.append('svg:text')
    .text('(knots)')
    .attr('transform','translate(-100,'+speed_scale(12)+')');
  y_axis_speed.call(yAxisSpeed);

  var y_axis_dir = plot.append("g")
    .attr("class", "y axis")
    .attr('transform','translate('+w+',0)');
  y_axis_dir.append('svg:text')
    .text('Wind Direction')
    .attr('transform','translate(100,'+speed_scale(15)+')');
  y_axis_dir.call(yAxisDir);

  var plotgroup = plot.append('g')
    .attr('class','plot-group');
};

var plot_wind = function() {
  var line_group = d3.select('#wind-chart .plot-group').append('svg:g')
    .attr('class','line-group');

  line_group.append('svg:path')
      .attr('d', dir_line(ascii))
      .style('stroke','blue')
      .attr('class','dir');

  line_group.append('svg:path')
      .attr('d', speed_line(ascii))
      .style('stroke','black')
      .attr('class','speed');

};

var replot_wind = function(win_length) {
  d3.select('.line-group .dir').transition()
    .attr('d',dir_line(rolling_circmean(ascii,'wind_direction', win_length)));
  d3.select('.line-group .speed').transition()
    .attr('d',speed_line(rolling_mean(ascii,'wind_speed', win_length)));
};

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

  var time_axis = plot.append("g")
  .attr("class", "x axis")
    .attr('transform','translate(0,'+h+')');
  time_axis.append('svg:text')
    .text('Last 3 Hours')
    .attr('transform','translate('+(w/2)+',100)');
  time_axis.call(timeAxis);

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

  var plotgroup = plot.append('g')
    .attr('class','plot-group');
};

var summary_data = [];

var compute_summaries = function() {
  var out = [];
  var size = ascii.length/12;
  var starts = d3.range(0, ascii.length, size);

  var get_speed = function(d) { return d.wind_speed; };
  var get_dir = function(d) { return d.wind_direction + 180; };

  for (var i = 0; i < starts.length; i++) {
    var b = ascii.slice(starts[i],starts[i]+size);
    var spd = b.map(get_speed);
    var tmp = get_5_num_summary(spd);
    var dir = b.map(get_dir);
    $().extend(tmp,get_circ_5_num_summary(dir));

    out.push(tmp);
  }
  summary_data = out;
};

var add_summary_bars = function() {
  var bar_groups = d3.select('#wind-summary g.plot-group').selectAll('.bar-group')
      .data(summary_data)
    .enter().append('svg:g')
      .attr('class','bar-group');

  bar_groups.append('svg:rect')
      .attr('height', function(d) { return speed_scale(d.spd_min) - speed_scale(d.spd_max);})
      .attr('width', summary_x(1))
      .style('fill','#deebf7')
      .attr('x', function(d,i) { return summary_x(i);})
      .attr('y', function(d) { return speed_scale(d.spd_max) - speed_scale(30);});

  bar_groups.append('svg:rect')
      .attr('height', function(d) { return speed_scale(d.spd_first) - speed_scale(d.spd_third);})
      .attr('width', summary_x(1))
      .style('fill','#9ecae1')
      .attr('x', function(d,i) { return summary_x(i);})
      .attr('y', function(d) { return speed_scale(d.spd_third) - speed_scale(30);});

  bar_groups.append('svg:line')
      .style('stroke','#3182bd')
      .style('stroke-width','2px')
      .attr('x1',function(d,i) { return summary_x(i); })
      .attr('x2',function(d,i) { return summary_x(i+1); })
      .attr('y1',function(d) { return speed_scale(d.spd_half); })
      .attr('y2',function(d) { return speed_scale(d.spd_half); });
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
  .y(function(d) { return speed_scale(d.spd_half); });

var speed_extremes = d3.svg.area()
  .interpolate('monotone')
  .x(pad_x)
  .y0(function(d) { return speed_scale(d.spd_min); })
  .y1(function(d) { return speed_scale(d.spd_max); });

var speed_quartiles = d3.svg.area()
  .interpolate('monotone')
  .x(pad_x)
  .y0(function(d) { return speed_scale(d.spd_first); })
  .y1(function(d) { return speed_scale(d.spd_third); });

var add_summary_ribbons = function() {
  var ribbon_group = d3.select('#wind-summary g.plot-group')
      .append('svg:g')
      .attr('class','ribbon-group');

  ribbon_group.append('svg:path')
      .style('fill','#deebf7')
      .attr('d', speed_extremes(summary_data));

  ribbon_group.append('svg:path')
      .style('fill','#9ecae1')
      .attr('d', speed_quartiles(summary_data));

  ribbon_group.append('svg:path')
      .style('stroke','#3182bd')
      .style('stroke-width','2px')
      .attr('d', speed_mean(summary_data));
};

var add_summary_dir_arrows = function() {
  var arrow_groups = d3.select('#wind-summary g.plot-group').selectAll('.arrow-group')
      .data(summary_data)
    .enter().append('svg:g')
      .attr('class','arrow-group')
      .attr('transform',function(d,i) {
        return 'translate('+summary_x(i)+','+(h+60)+') rotate('+d.dir_half+','+summary_x(0.5)+',0)';
      });

  var outer_arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(summary_x(0.85))
        .startAngle(function(d) {
          return deg2rad(d.dir_min);
        })
        .endAngle(function(d) {
          return deg2rad(d.dir_max);
        });

  var inner_arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(summary_x(0.85))
        .startAngle(function(d) {
          return deg2rad(d.dir_first);
        })
        .endAngle(function(d) {
          return deg2rad(d.dir_third);
        });

  arrow_groups.append("path")
    .attr("d", outer_arc)
    .style("fill", '#e5f5f9')
    .attr('transform','translate('+summary_x(0.5)+',25)');

  arrow_groups.append("path")
    .attr("d", inner_arc)
    .style("fill", '#a1d99b')
    .attr('transform','translate('+summary_x(0.5)+',25)');

  // Mean direction line
  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','2px')
      .attr('x1',function(d,i) { return summary_x(0.5); })
      .attr('x2',function(d,i) { return summary_x(0.5); })
      .attr('y1',function(d) { return summary_x(0)-summary_x(0.4); })
      .attr('y2',function(d) { return summary_x(0)+summary_x(0.4); });
  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','2px')
      .attr('x1',function(d,i) { return summary_x(0.35); })
      .attr('x2',function(d,i) { return summary_x(0.5); })
      .attr('y1',function(d) { return summary_x(0)-summary_x(0.3); })
      .attr('y2',function(d) { return summary_x(0)-summary_x(0.4); });
  arrow_groups.append('svg:line')
      .style('stroke','#31a354')
      .style('stroke-width','2px')
      .attr('x1',function(d,i) { return summary_x(0.5); })
      .attr('x2',function(d,i) { return summary_x(0.65); })
      .attr('y1',function(d) { return summary_x(0)-summary_x(0.4); })
      .attr('y2',function(d) { return summary_x(0)-summary_x(0.3); });

};

// Initial callback on data pull
var draw_plots = function() {

  draw_summary();
  update_timescale();
  compute_summaries();
  //add_summary_bars();
  add_summary_ribbons();
  add_summary_dir_arrows();

  draw_timeseries();
  update_timescale();
  plot_wind();
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

pull_last_3_hours();
