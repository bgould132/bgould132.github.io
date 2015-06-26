/*jslint plusplus: true */
(function () {
    
    var i, len, margin, width, height, demain = [],
        data = [],
        parseDate, bisectDate, dateToYear,
        x, y, xAxis, yAxis,
        focus, chart, lineFunc, years = [];

    margin = {top: 32, right: 0, bottom: 30, left: 40};
    width = $(".alphatext").width();
    width = width - margin.left - margin.right;
    height = $(".alphatext").height() - margin.top - margin.bottom;

    parseDate = d3.time.format("%d-%b-%Y").parse;
    bisectDate = d3.bisector(function (d) { return d.date; }).left;
    dateToYear = d3.time.format("%Y");

    for (i = 0; i < 51; i++) {
        years[i] = parseDate("1-Jan-" + (i + 2000).toString());
    }

    //Sets ordinal x scale, which basically means the data is supposed to come in an order.
    x = d3.time.scale()
        .range([0, width]);

    //Sets linear y scale, so the height is proportional to the value
    y = d3.scale.linear()
        .range([height, 0]);

    //Creates an xAxis printer, that creates an xAxis whenever you call it, positioned relative to local origin
    xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(5);

    //Creates yAxis printer
    yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")//;
        .ticks(5);

    //This creates the chart area
    chart = d3.select("#deathchart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //End Variable Declaration
    //********************************************//
    
    //Helper functions
    //********************************************//
    function mousemove() {
        var x0 = x.invert(d3.mouse(this)[0]),
            i = bisectDate(data, x0, 1),
            d0 = data[i - 1],
            d1 = data[i],
            d = x0 - d0.date > d1.date - x0 ? d1 : d0;
        focus.attr("transform", "translate(" + x(d.date) + "," + y(d.deaths) + ")");
        focus.select("text").text(d.deaths);
        chart.select(".xlegend").text(dateToYear(d.date));
    }

    //Program core
    //********************************************//
    d3.csv("csv/Annual Deaths.csv", function (error, input) {
        
        for (i = 0; i < years.length; i++) {
            data[i] = {};
            data[i].date = years[i];
            data[i].deaths = (input[i].Deaths / 1000).toFixed(0);
        }
                
        x.domain([years[0], years[(years.length - 1)]]);
        
        len = data.length;
        
        for (i = 0; i < len; i++) {
            demain[i] = +data[i].deaths;
        }
        
        y.domain([0, d3.max(demain)]);
        
        //y.domain([0, d3.max(data, function (d) { return d.Deaths; })]);

        //To move xAxis to desired location & call it:
        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
        //For adding the X axis legend
            .append("text")
            .attr("class", "xlegend")
            .attr("x", width - 10) // moves it out from the origin, -10 keeps it from going too far
            .attr("y", -5) // moves it up above the x-axis (inverted y scale for svg)
            .attr("dx", ".71em")
            .style("text-anchor", "end")
            .text("Year");

        //For adding the Y axis
        chart.append("g")
            .attr("class", "y axis")
            //.attr("transform", "translate(" + 0+ ",)")
            .call(yAxis)

        //For adding the Y axis legend
            .append("text")
            .attr("class", "ylegend")
            .attr("y", -20) 
            .attr("x", 160)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Annual deaths (thousands)");

        //For computing the line
        lineFunc = d3.svg.line()
            .x(function (d) { return x(d.date); })
            .y(function (d) { return y(d.deaths); })
            .interpolate('basis');

        chart.append('svg:path')
            .attr('d', lineFunc(data))
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 2)
            .attr('fill', 'none');

        focus = chart.append("g")
            .attr("class", "focus")
            .style("display", "none");

        focus.append("circle")
            .attr("r", 4.5);

        focus.append("text")
            .attr("x", -10)
            .attr("y", 15)
            .attr("dy", ".35em");

        chart.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function () { focus.style("display", null); })
            .on("mouseout", function () { focus.style("display", "none"); chart.select(".xlegend").text("Year"); })
            .on("mousemove", mousemove);

    });
}());
