
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

var padding = 40,
    width = 1100,
    height = 450,
    started = false;

var margins = [50, 200, 50, 200],
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

var xAxis = d3.svg.axis().scale(x).orient("top");
var timeAxis = d3.svg.axis().scale(time_scale).orient("bottom");
var yAxisSpeed = d3.svg.axis().scale(speed_scale).orient("left");
var yAxisDir = d3.svg.axis().scale(dir_scale).tickValues([0,45,90,135,180,225,270,315,360]).orient("right");

var draw_timeseries = function() {
  var windchart = d3.select("#wind-chart")
      .append("svg:svg")
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
    .attr('transform','translate(-100,'+speed_scale(15)+')');
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

var speed_line = d3.svg.line()
  .interpolate('monotone')
  .x(function(d,i) { return time_scale(d.stamp); })
  .y(function(d) { return speed_scale(d.wind_speed); });

var dir_line = d3.svg.line()
  .interpolate('monotone')
  .x(function(d,i) { return time_scale(d.stamp); })
  .y(function(d) { return dir_scale(d.wind_direction); });

var plot_wind = function() {
  var line_group = d3.select('.plot-group').append('svg:g')
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

var format = d3.time.format("%Y-%m-%d %X");
var ascii = [];

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

var yql_json2ascii = function(d) {
  var myascii = [];
  out = {};
  for (var i = 0; i < d.data.length; i++) {
    out = {stamp: format.parse(d.stamps[i])};
    for (var j = 0; j < d.symbols.length; j++) {
      out[d.symbols[j]] = +d.data[i].json[j];
    }

    myascii.push(out);
  }
  return myascii;
};


//d3.json('data.json', function(d) {
//  ascii = json2ascii(d);
//  update_timescale();
//  plot_wind();
//});

var draw_plots = function() {
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

// May also use: http://whateverorigin.org/
var pull_tower = function() {
  $.getJSON("http://query.yahooapis.com/v1/public/yql",
    {
      q:      "select * from json where url=\"http://metobs.ssec.wisc.edu/app/rig/tower/data/json?begin=2014-02-17%2018:37:00&end=2014-02-17%2021:37:00&symbols=dir:spd:&separator=,&interval=00:00:05\"",
      format: "json"
    },
    function(data){
      if (data.query.results) {
        console.log('Got results!');
        console.log(data.query.results.json);
        ascii = yql_json2ascii(data.query.results.json);
        draw_plots();
      } else {
        console.log('Did not get results!');
      }
    }
  );
};

pull_local();
