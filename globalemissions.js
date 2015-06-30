//'use strict';
/*jslint plusplus: true */

//****************************************************************************************//
//Data Structure Guide
/*

Most objects = new VehicleObj. 
A VehicleObj is an object with 8 children: one for each vehicle type, plus AllVehicles.
Each vehicle type is typically a FuelObj: an object with 3 children, one for each fuel plus AllFuels
Each fuel is then a RegionObj: an object with 17 children, one for each region plus Global.
Regions are arrays, but for globalEmissions they're arrays of objects. 
In globalEmissions, the regions are arrays (index corresponding to year) of objects with the 7 pollutant values. 

So the overall data structure is: globalVariable -> Vehicle type -> Fuel type -> Region -> Array index

globalvktpctbyage is a VehicleObj with Region children, not fuel children. 

When opening the CSV files, their variables (e.g. ldvvkt) are arrays of objects.
Each array index holds an object with key: value pairs, where the key is the column header and the value is the value of that column at the index of the array (so e.g. in a 2-column table, array[3] will be {column1: value3, column2: value3})

Note: CSV files are pulled asynchronously, so in order to make the program wait until they've loaded, everything has to be nested in CSV calls.

d3 requires its plot values to be arrays of objects with key:value pairs corresponding to xaxis: value, yaxis: value, so the variable
"data" is an array of 51 objects, with each array index holding an x-axis ("Horiz") and y-axis ("Vertic") key-value pair.
*/

//****************************************************************************************//
//Comparison to the ICCT Roadmap Model
/*

Here are a list of changes and simplifications made from the ICCT Roadmap Model:
 - Did not include fuels other than gasoline and diesel (that is, left out CNG, LPG, electric, and hydrogen).
    - As a result, when calculating vkt share by fuel type, in some cases the total of gasoline and diesel will not be 100%, where other fuels were present. In most cases, other fuels made up less than 2% of the total. India's 3-wheeler fleet is a notable exception.
 - Did not include non-road vehicles (e.g. marine, aviation).
 - For regions with phased implementation of emission control standards (e.g. China, India), the year of 100% implementation was used.
 - The "Baseline" scenario for standard implementation was used, rather than trajectory, to allow for (future) user control over implementation of policies
 - Dates of standard implementation were written into the program (see vehicleesyear and esInit())
 - All regions were assumed to have the same fleet-averaged emission standards for a given emission control (see vehicleef)
 - Global vkt percent by age was taken from the average across vehicle types, which weighs it heavily towards the US fleet age distribution
 - 
 
 
Here are a list of key assumptions made in the ICCT Roadmap Model that are carried over in this program:
 - ICCT Roadmap growth, vkt, and vkt share assumptions are all kept constant.
 - 

*/

(function () {
    //Begin Variable Declaration //
    //****************************************************************************************//

    var i, j, k, m, n, p, len, len2, len3, len4, len5, len6, sum, //Placeholders, variables that change throughout, or are updated later
        region = "China",
        pollutant = "PM",
        vehicle = "HHDT",
        fuel = "Diesel",
        demain = [], // A holder for domain values
        data = [], // The output of the emissions calculations, based on selected region, pollutant, vehicle, and fuel
        data2 = [],
        ldvgases, ldvdieseles, busgases, busdieseles, twogases, twodieseles, threegases, threedieseles, lhdtgases, lhdtdieseles, mhdtgases, mhdtdieseles, hhdtgases, hhdtdieseles, //vehicle-fuel emission standards
        yearproduced, index,
        globalvkt = {},
        globalvktpctbyage = {},
        globalemissions = {},
        globalvktbystd = {},
        vehicleef = {},
        vehicleesyear = {},
        years = [],
        focus2, linefunc2,
        focus, lineFunc, // These draw the circle & the line of the chart
        euvidate = 2025, //old
        emissionschart, vktchart,
        margin, width, height, // These define the area of the chart
        x, y, x2, y2, // These are d3 variables setting range & domain of axes
        xAxis, yAxis, xAxis2, yAxis2, chart, // These work to make the chart and x & y axes
        parseDate, bisectDate, dateToYear, // These are date operators
        regionList, pollutantList, vehicleList, fuelList, standardList, // These are helper arrays
        PollutantEmissionFactors, EmissionLevel, VKTLevel, Emissions2, FuelEFs, OtherFuelEFs, VehicleObj, RegionObj, FuelObj; // Constructors

   
    //Date operators
    parseDate = d3.time.format("%d-%b-%Y").parse;
    bisectDate = d3.bisector(function (d) { return d.Horiz; }).left;
    dateToYear = d3.time.format("%Y");

    //Keys
    //********************************************//
    regionList = ["US", "Canada", "Mexico", "Brazil", "LA-31", "EU-28", "Russia", "Non-EU-Europe", "China", "Japan", "India", "South_Korea", "Australia", "Asia-Pacific-40", "Middle_East", "Africa", "Global"];

    pollutantList = ["CH4", "N2O", "NOx", "CO", "HC", "PM", "BC"];

    vehicleList = ["LDV", "Bus", "TwoWheeler", "ThreeWheeler", "LHDT", "MHDT", "HHDT", "AllVehicles"];

    fuelList = ["Gasoline", "Diesel", "AllFuels"];
    
    standardList = ["Uncontrolled", "Euro1", "Euro2", "Euro3", "Euro4", "Euro5", "Euro6", "SULEV"];

    //End Variable Declaration
    //****************************************************************************************//

    //Constructors
    //****************************************************************************************//

    PollutantEmissionFactors = function PollutantEmissionFactors(uncontrolled, eu1, eu2, eu3, eu4, eu5, eu6, sulev) {
        this.Uncontrolled = uncontrolled;
        this.Euro1 = eu1;
        this.Euro2 = eu2;
        this.Euro3 = eu3;
        this.Euro4 = eu4;
        this.Euro5 = eu5;
        this.Euro6 = eu6;
        this.SULEV = sulev;
    };

    EmissionLevel = function EmissionLevel(year) {
        this.Horiz = years[year];
        this.Vertic = globalemissions[vehicle][fuel][region][year][pollutant].toFixed(2);
    };
    
    VKTLevel = function VKTLevel(year) {
        this.Horiz = years[year];
        this.Vertic = globalvktbystd[vehicle][fuel][region][year][5].toFixed(3);
    };
    
    //rename
    Emissions2 = function Emissions2() {
        this.CH4 = 0;
        this.N2O = 0;
        this.NOx = 0;
        this.CO = 0;
        this.HC = 0;
        this.PM = 0;
        this.BC = 0;
    };
    
    FuelEFs = function FuelEFs(CH4, N20, NOx, CO, HC, PM, BC) {
        this.CH4 = new PollutantEmissionFactors(CH4[0], CH4[1], CH4[2], CH4[3], CH4[4], CH4[5], CH4[6], CH4[7]);
        this.N2O = new PollutantEmissionFactors(N20[0], N20[1], N20[2], N20[3], N20[4], N20[5], N20[6], N20[7]);
        this.NOx = new PollutantEmissionFactors(NOx[0], NOx[1], NOx[2], NOx[3], NOx[4], NOx[5], NOx[6], NOx[7]);
        this.CO = new PollutantEmissionFactors(CO[0], CO[1], CO[2], CO[3], CO[4], CO[5], CO[6], CO[7]);
        this.HC = new PollutantEmissionFactors(HC[0], HC[1], HC[2], HC[3], HC[4], HC[5], HC[6], HC[7]);
        this.PM = new PollutantEmissionFactors(PM[0], PM[1], PM[2], PM[3], PM[4], PM[5], PM[6], PM[7]);
        this.BC = new PollutantEmissionFactors(BC[0], BC[1], BC[2], BC[3], BC[4], BC[5], BC[6], BC[7]);
    };

    OtherFuelEFs = function OtherFuelEFs(CH4, N2O, NOx, CO, HC, PM, BC) {
        this.CH4 = CH4;
        this.N2O = N2O;
        this.NOx = NOx;
        this.CO = CO;
        this.HC = HC;
        this.PM = PM;
        this.BC = BC;
    };
    
    VehicleObj = function VehicleObj() {
        this.LDV = {};
        this.Bus = {};
        this.TwoWheeler = {};
        this.ThreeWheeler = {};
        this.LHDT = {};
        this.MHDT = {};
        this.HHDT = {};
        this.AllVehicles = {};
    };
    
    RegionObj = function RegionObj() {
        this.US = [];
        this.Canada = [];
        this.Mexico = [];
        this.Brazil = [];
        this["LA-31"] = [];
        this["EU-28"] = [];
        this.Russia = [];
        this["Non-EU-Europe"] = [];
        this.China = [];
        this.Japan = [];
        this.India = [];
        this.South_Korea = [];
        this.Australia = [];
        this["Asia-Pacific-40"] = [];
        this.Middle_East = [];
        this.Africa = [];
        this.Global = [];
    };
    
    FuelObj = function FuelObj() {
        this.Gasoline = new RegionObj();
        this.Diesel = new RegionObj();
        this.AllFuels = new RegionObj();
    };
    
    //End Constructor Declaration
    //****************************************************************************************//


    //Helper Functions
    //****************************************************************************************//
    
    function drawCharts(chartselect, widthfraction) {
     //Chart Formation
    //********************************************//
    //This defines the chart (width and height)
        margin = {top: 50, right: 30, bottom: 30, left: 40};
        width = $(document).width();
        width = widthfraction * width - margin.left - margin.right;
        height = 250 - margin.top - margin.bottom;

        x = d3.time.scale()
            .range([0, width]); //sets the pixel range of the x-axis

        y = d3.scale.linear()
            .range([height, 0]); //sets the pixel range of the y-axis

        xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .ticks(5);

        yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(5);

        chart = d3.select("#" + chartselect)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    }
    
    function dataCalc() {
        len = vehicleList.length; //i
        len2 = fuelList.length; //j
        len3 = regionList.length; //k
        len4 = 51; //m
        len5 = pollutantList.length; //n
        len6 = globalvktpctbyage[vehicleList[0]][regionList[0]].length; //p
        
        for (i = 0; i < (len - 1); i++) { //For each vehicle type
            for (j = 0; j < (len2 - 1); j++) { //For each fuel type
                for (k = 0; k < (len3 - 1); k++) { //For each region
                    for (m = 0; m < len4; m++) { //For each year (0-50)
                        fleetVKTbystd(m); //Fleet VKT by euro standard calculations
                        for (n = 0; n < len5; n++) { //For each pollutant
                            globalemissions[vehicleList[i]][fuelList[j]][regionList[k]][m][pollutantList[n]] = fleetEF(m) * globalvkt[vehicleList[i]][fuelList[j]][regionList[k]][m];
                        }
                    }
                }
            }
        }
        
        //Check this calculation
        //Summing across regions (within each fuel type within each vehicle type) to get global emissions:
        for (i = 0; i < (len - 1); i++) {
            for (j = 0; j < (len2 - 1); j++) {
                for (m = 0; m < len4; m++) {
                    for (n = 0; n < len5; n++) {
                        for (k = 0; k < (len3 - 1); k++) {
                            globalemissions[vehicleList[i]][fuelList[j]][regionList[(len3 - 1)]][m][pollutantList[n]] += globalemissions[vehicleList[i]][fuelList[j]][regionList[k]][m][pollutantList[n]];
                        }
                    }
                }
            }
        }
        
        //Check this calculation
        //Summing across fuel types (within each vehicle type) to get all fuel emissions:
        for (i = 0; i < (len - 1); i++) {
            for (k = 0; k < len3; k++) {
                for (m = 0; m < len4; m++) {
                    for (n = 0; n < len5; n++) {
                        for (j = 0; j < (len2 - 1); j++) {
                            globalemissions[vehicleList[i]][fuelList[(len2 - 1)]][regionList[k]][m][pollutantList[n]] += globalemissions[vehicleList[i]][fuelList[j]][regionList[k]][m][pollutantList[n]];
                        }
                    }
                }
            }
        }
        
        //Check this calculation
        //Summing across vehicles to get all vehicles:
        for (j = 0; j < len2; j++) {
            for (k = 0; k < len3; k++) {
                for (m = 0; m < len4; m++) {
                    for (n = 0; n < len5; n++) {
                        for (i = 0; i < (len - 1); i++) {
                            globalemissions[vehicleList[(len - 1)]][fuelList[j]][regionList[k]][m][pollutantList[n]] += globalemissions[vehicleList[i]][fuelList[j]][regionList[k]][m][pollutantList[n]];
                        }
                    }
                }
            }
        }
        
        //Summing across regions (within each fuel type within each vehicle type) to get global emissions:
        for (i = 0; i < (len - 1); i++) {
            for (j = 0; j < (len2 - 1); j++) {
                for (m = 0; m < len4; m++) {
                    for (p = 0; p < len6; p++) {
                        for (k = 0; k < (len3 - 1); k++) {
                            globalvktbystd[vehicleList[i]][fuelList[j]][regionList[(len3 - 1)]][m][p] += globalvktbystd[vehicleList[i]][fuelList[j]][regionList[k]][m][p];
                        }
                    }
                }
            }
        }
        
        //Summing across fuel types (within each vehicle type) to get all fuel emissions:
        for (i = 0; i < (len - 1); i++) {
            for (k = 0; k < len3; k++) {
                for (m = 0; m < len4; m++) {
                    for (p = 0; p < len6; p++) {
                        for (j = 0; j < (len2 - 1); j++) {
                            globalvktbystd[vehicleList[i]][fuelList[(len2 - 1)]][regionList[k]][m][p] += globalvktbystd[vehicleList[i]][fuelList[j]][regionList[k]][m][p];
                        }
                    }
                }
            }
        }
        
         //Summing across vehicles to get all vehicles:
        for (j = 0; j < len2; j++) {
            for (k = 0; k < len3; k++) {
                for (m = 0; m < len4; m++) {
                    for (p = 0; p < len6; p++) {
                        for (i = 0; i < (len - 1); i++) {
                            globalvktbystd[vehicleList[(len - 1)]][fuelList[j]][regionList[k]][m][p] += globalvktbystd[vehicleList[i]][fuelList[j]][regionList[k]][m][p];
                        }
                    }
                }
            }
        }
    }
    
    function dataRecalc() {
        for (k = 0; k < 51; k++) {
            data[k] = new EmissionLevel(k);
            data2[k] = new VKTLevel(k);
        }
    }
    
    //Sets up the vehicle emission factors
    function vehicleefInit() {
        vehicleef = {
            LDV: {
                Gasoline: new FuelEFs([0.0995, 0.0201, 0.0145, 0.0027, 0.0027, 0.0027, 0.0027, 0.0027],
                                      [0.0080, 0.0201, 0.0123, 0.0030, 0.0021, 0.0021, 0.0021, 0.0021],
                                      [2.4175, 0.3641, 0.1741, 0.0796, 0.0505, 0.0372, 0.0372, 0.0307],
                                      [26.5195, 3.0505, 1.5176, 1.2461, 0.6054, 0.6054, 0.6054, 0.6054],
                                      [2.4056, 0.2085, 0.0758, 0.0226, 0.0129, 0.0129, 0.0129, 0.0023],
                                      [0.0025, 0.0025, 0.0025, 0.0011, 0.0011, 0.0011, 0.0011, 0.0011],
                                      [0.0002, 0.0006, 0.0006, 0.0002, 0.0002, 0.0002, 0.0002, 0.0002]),
                Diesel: new FuelEFs([0.0179, 0.0087, 0.0045, 0.0012, 0.0005, 0.0005, 0.0005, 0.0005],
                                        [0.0000, 0.0032, 0.0052, 0.0052, 0.0061, 0.0061, 0.0061, 0.0061],
                                        [0.8982, 0.8500, 0.8758, 0.8451, 0.6548, 0.6809, 0.2555, 0.0307],
                                        [0.8463, 0.4493, 0.3857, 0.1943, 0.1691, 0.1691, 0.1691, 0.1691],
                                        [0.1597, 0.0770, 0.0647, 0.0377, 0.0188, 0.0188, 0.0188, 0.0023],
                                        [0.2403, 0.0775, 0.0643, 0.0429, 0.0310, 0.0015, 0.0015, 0.0015],
                                        [0.1322, 0.0543, 0.0514, 0.0364, 0.0269, 0.0003, 0.0003, 0.0003])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            Bus: {
                Gasoline: new FuelEFs([4.3992, 0.2242, 0.2242, 0.1663, 0.1663, 0.0651, 0.0651, 0.0651],
                                        [0.0011, 0.0151, 0.0142, 0.0121, 0.0121, 0.0042, 0.0011, 0.0011],
                                        [5.7366, 3.6811, 3.4489, 2.9500, 2.9500, 1.0063, 0.2666, 0.0824],
                                        [189.6083, 148.7599, 40.9648, 9.8864, 8.5331, 8.5331, 8.5331, 8.5331],
                                        [14.0777, 0.7187, 0.7187, 0.5345, 0.5345, 0.2081, 0.2081, 0.0045],
                                        [0.0936, 0.0158, 0.0149, 0.0149, 0.0149, 0.0144, 0.0056, 0.0056],
                                        [0.0322, 0.0079, 0.0079, 0.0085, 0.0085, 0.0085, 0.0021, 0.0021]),
                Diesel: new FuelEFs([0.1287, 0.1287, 0.0837, 0.0759, 0.0039, 0.0039, 0.0039, 0.0039],
                                        [0.0300, 0.0101, 0.0099, 0.0053, 0.0126, 0.0347, 0.0378, 0.0378],
                                        [13.7791, 9.4144, 10.2752, 8.8863, 5.7125, 5.5004, 0.5496, 0.0824],
                                        [4.4914, 2.2855, 2.0856, 2.3273, 1.1344, 2.1618, 1.1809, 1.1809],
                                        [1.7634, 0.7021, 0.4812, 0.4557, 0.0619, 0.0378, 0.0299, 0.0045],
                                        [0.7028, 0.3734, 0.1880, 0.1841, 0.0448, 0.0445, 0.0046, 0.0046],
                                        [0.3514, 0.2427, 0.1222, 0.1289, 0.0336, 0.0334, 0.0007, 0.0007])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            TwoWheeler: {
                Gasoline: new FuelEFs([0.2000, 0.1409, 0.1206, 0.0639, 0.0391, 0.0235, 0.0156, 0.0156],
                                        [0.0020, 0.0020, 0.0020, 0.0020, 0.0017, 0.0010, 0.0007, 0.0007],
                                        [0.3056, 0.3221, 0.2648, 0.2396, 0.2033, 0.1220, 0.0813, 0.0813],
                                        [16.4375, 11.3336, 4.1823, 2.3126, 1.6188, 0.9713, 0.6475, 0.6475],
                                        [1.3791, 1.1249, 0.4820, 0.3000, 0.1816, 0.1089, 0.0726, 0.0726],
                                        [0.0200, 0.0200, 0.0050, 0.0050, 0.0024, 0.0014, 0.0010, 0.0010],
                                        [0.0030, 0.0050, 0.0013, 0.0013, 0.0006, 0.0004, 0.0002, 0.0002]),
                Diesel: new FuelEFs([0.0047, 0.0011, 0.0010, 0.0006, 0.0004, 0.0002, 0.0002, 0.0002],
                                        [0.0393, 0.0803, 0.0723, 0.0482, 0.0409, 0.0245, 0.0164, 0.0164],
                                        [0.5165, 0.5645, 0.5080, 0.3387, 0.2874, 0.1724, 0.1150, 0.1150],
                                        [5.8784, 1.8595, 1.6735, 1.1157, 0.7810, 0.4686, 0.3124, 0.3124],
                                        [0.0839, 0.0191, 0.0172, 0.0115, 0.0070, 0.0042, 0.0028, 0.0028],
                                        [0.1429, 0.0327, 0.0250, 0.0147, 0.0071, 0.0040, 0.0027, 0.0027],
                                        [0.0484, 0.0128, 0.0099, 0.0056, 0.0027, 0.0009, 0.0006, 0.0006])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            ThreeWheeler: {
                Gasoline: new FuelEFs([0.2000, 0.1013, 0.0823, 0.0414, 0.0253, 0.0152, 0.0101, 0.0101],
                                        [0.0020, 0.0020, 0.0020, 0.0020, 0.0017, 0.0010, 0.0007, 0.0007],
                                        [0.1358, 0.1610, 0.1256, 0.0648, 0.0550, 0.0330, 0.0220, 0.0220],
                                        [22.0619, 11.7086, 2.6318, 1.4529, 1.0170, 0.6102, 0.4068, 0.4068],
                                        [2.6588, 1.2032, 0.4385, 0.2728, 0.1650, 0.0990, 0.0660, 0.0660],
                                        [0.0200, 0.0200, 0.0050, 0.0050, 0.0025, 0.0014, 0.0009, 0.0009],
                                        [0.0030, 0.0050, 0.0013, 0.0013, 0.0006, 0.0004, 0.0002, 0.0002]),
                Diesel: new FuelEFs([0.0072, 0.0022, 0.0026, 0.0016, 0.0010, 0.0006, 0.0004, 0.0004],
                                        [0.0367, 0.0099, 0.0119, 0.0074, 0.0063, 0.0038, 0.0025, 0.0025],
                                        [0.2137, 0.0309, 0.0371, 0.0232, 0.0197, 0.0118, 0.0079, 0.0079],
                                        [15.2211, 5.3333, 3.5999, 2.0000, 1.4000, 0.8400, 0.5600, 0.5600],
                                        [0.3876, 0.1173, 0.1407, 0.0880, 0.0538, 0.0323, 0.0215, 0.0215],
                                        [0.1246, 0.0436, 0.0543, 0.0336, 0.0163, 0.0094, 0.0060, 0.0060],
                                        [0.0515, 0.0208, 0.0261, 0.0155, 0.0076, 0.0025, 0.0016, 0.0016])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            LHDT: {
                Gasoline: new FuelEFs([0.0490, 0.0054, 0.0035, 0.0040, 0.0008, 0.0008, 0.0008, 0.0008],
                                        [0.0060, 0.0708, 0.0402, 0.0446, 0.0097, 0.0079, 0.0079, 0.0079],
                                        [4.8414, 2.5920, 1.4722, 1.6322, 0.3570, 0.2883, 0.2883, 0.0307],
                                        [4.0598, 0.7692, 0.4869, 0.4711, 0.2212, 0.2212, 0.2212, 0.2212],
                                        [3.8009, 2.4206, 0.2678, 0.3133, 0.0601, 0.0601, 0.0601, 0.0013],
                                        [0.0680, 0.0228, 0.0086, 0.0057, 0.0047, 0.0044, 0.0044, 0.0044],
                                        [0.0279, 0.0072, 0.0016, 0.0014, 0.0012, 0.0012, 0.0012, 0.0012]),
                Diesel: new FuelEFs([0.0438, 0.0438, 0.0278, 0.0197, 0.0018, 0.0018, 0.0018, 0.0018],
                                        [0.0300, 0.0048, 0.0044, 0.0027, 0.0064, 0.0173, 0.0176, 0.0176],
                                        [4.6524, 3.3648, 3.5805, 2.7816, 1.8983, 1.4880, 0.2328, 0.0307],
                                        [1.9615, 0.7041, 0.5689, 0.6444, 0.3476, 0.6248, 0.3579, 0.3579],
                                        [1.1296, 0.2249, 0.1512, 0.1408, 0.0220, 0.0130, 0.0102, 0.0013],
                                        [0.3108, 0.1246, 0.0651, 0.0616, 0.0156, 0.0142, 0.0016, 0.0016],
                                        [0.1554, 0.0810, 0.0423, 0.0431, 0.0117, 0.0107, 0.0002, 0.0002])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            MHDT: {
                Gasoline: new FuelEFs([0.9880, 0.0513, 0.0513, 0.0403, 0.0403, 0.0165, 0.0165, 0.0165],
                                        [0.0010, 0.0156, 0.0149, 0.0124, 0.0124, 0.0042, 0.0010, 0.0010],
                                        [3.2008, 2.2253, 2.1261, 1.7683, 1.7683, 0.6087, 0.1493, 0.0409],
                                        [67.6201, 47.3089, 15.8624, 4.1133, 3.6594, 3.6594, 3.6594, 3.6594],
                                        [4.8566, 0.2520, 0.2520, 0.1982, 0.1982, 0.0813, 0.0813, 0.0021],
                                        [0.0721, 0.0129, 0.0121, 0.0128, 0.0122, 0.0119, 0.0042, 0.0042],
                                        [0.0411, 0.0099, 0.0102, 0.0112, 0.0112, 0.0112, 0.0024, 0.0024]),
                Diesel: new FuelEFs([0.0342, 0.0342, 0.0213, 0.0131, 0.0016, 0.0016, 0.0016, 0.0016],
                                        [0.0300, 0.0053, 0.0051, 0.0030, 0.0077, 0.0216, 0.0210, 0.0210],
                                        [8.1243, 4.8542, 5.1764, 4.0001, 2.7546, 1.8792, 0.2726, 0.0409],
                                        [2.0354, 0.9824, 0.8563, 0.9743, 0.4814, 0.8730, 0.4961, 0.4961],
                                        [0.7201, 0.3063, 0.2047, 0.1887, 0.0288, 0.0174, 0.0139, 0.0021],
                                        [0.2805, 0.1750, 0.1009, 0.0868, 0.0220, 0.0206, 0.0022, 0.0022],
                                        [0.1403, 0.1138, 0.0656, 0.0608, 0.0165, 0.0154, 0.0003, 0.0003])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            },
            HHDT: {
                Gasoline: new FuelEFs([2.8513, 0.1261, 0.1261, 0.0972, 0.0972, 0.0395, 0.0395, 0.0395],
                                        [0.0011, 0.0142, 0.0135, 0.0114, 0.0114, 0.0039, 0.0010, 0.0010],
                                        [4.8902, 2.8317, 2.6912, 2.2723, 2.2723, 0.7841, 0.2003, 0.0499],
                                        [93.7891, 61.4900, 17.9665, 4.6348, 4.0375, 4.0375, 4.0375, 4.0375],
                                        [4.9383, 0.2186, 0.2186, 0.1689, 0.1689, 0.0690, 0.0690, 0.0034],
                                        [0.0501, 0.0090, 0.0083, 0.0087, 0.0083, 0.0083, 0.0038, 0.0038],
                                        [0.0171, 0.0042, 0.0042, 0.0048, 0.0048, 0.0048, 0.0011, 0.0011]),
                Diesel: new FuelEFs([0.0850, 0.0850, 0.0520, 0.0238, 0.0049, 0.0049, 0.0049, 0.0049],
                                        [0.0300, 0.0108, 0.0105, 0.0062, 0.0165, 0.0476, 0.0450, 0.0450],
                                        [11.3282, 7.8332, 8.3581, 6.6662, 4.5810, 2.8034, 0.3329, 0.0499],
                                        [2.3505, 1.8568, 1.6299, 1.8017, 0.7841, 1.3877, 0.8098, 0.8098],
                                        [0.6307, 0.4971, 0.3284, 0.3013, 0.0461, 0.0283, 0.0226, 0.0034],
                                        [0.4105, 0.3067, 0.1893, 0.1485, 0.0346, 0.0336, 0.0035, 0.0035],
                                        [0.2052, 0.1993, 0.1230, 0.1040, 0.0260, 0.0287, 0.0005, 0.0005])//,
                //CNG: new OtherFuelEFs(0.0429, 0.0000, 0.0524, 0.2329, 0.0515, 0.0011, 0.0079),
                //LNG: new OtherFuelEFs(0.0017, 0.0032, 0.0524, 0.2329, 0.0127, 0.0011, 0.0079)
            }
        };
    }
    
    //Sets up the emission standard year-of-implementation tables
    function esInit() {
        ldvgases = [[1960, 1981, 1987, 1995, 2004, 0, 2008, 0],
                [1960, 1981, 1987, 1995, 2004, 0, 2008, 0],
                [1960, 1993, 0, 2001, 0, 0, 0, 0],
                [1960, 0, 1997, 2008, 2009, 2015, 0, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1993, 1997, 2001, 2006, 2011, 2015, 0],
                [1960, 1999, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2005, 2010, 2015, 0, 0, 0],
                [1960, 2000, 2005, 2008, 2011, 2018, 0, 0],
                [1960, 1994, 1997, 2002, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 2060, 0, 0, 0],
                [1960, 1995, 0, 2006, 2007, 0, 2009, 0],
                [1960, 1996, 2004, 2006, 2010, 2013, 2018, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2002, 2010, 0, 0, 0, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0]];

        ldvdieseles = [[1960, 1980, 1984, 1995, 0, 2004, 2008, 0],
                [1960, 1980, 1984, 1995, 0, 2004, 2008, 0],
                [1960, 1999, 2001, 2004, 0, 0, 0, 0],
                [1960, 0, 1997, 2008, 2009, 0, 0, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1993, 1997, 2001, 2006, 2011, 2015, 0],
                [1960, 1999, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2005, 2010, 2015, 0, 0, 0],
                [1960, 2000, 2005, 2008, 2013, 2018, 0, 0],
                [1960, 1994, 1997, 2004, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 2060, 0, 0, 0],
                [1960, 1995, 0, 2005, 2006, 2012, 2014, 0],
                [1960, 1996, 2003, 0, 2007, 2013, 2018, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2002, 2010, 0, 0, 0, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0]];

        busgases = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2005, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2003, 2004, 2010, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 2060, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 2004, 0, 2011, 0, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        busdieseles = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2005, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2001, 2004, 2008, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 2060, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2003, 2008, 2011, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        twogases = [[1960, 0, 2006, 0, 0, 0, 0, 0],
                [1960, 0, 2006, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2003, 2006, 2010, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 1999, 2004, 2006, 2016, 2020, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2003, 2004, 2008, 0, 0, 0, 0],
                [1960, 1998, 0, 0, 2007, 0, 0, 0],
                [1951, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 2010, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0]];

        twodieseles = [[1960, 0, 2006, 0, 0, 0, 0, 0],
                [1960, 0, 2006, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2003, 2006, 2010, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 1999, 2004, 2006, 2016, 2020, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2003, 2004, 2008, 0, 0, 0, 0],
                [1960, 1998, 0, 0, 2007, 0, 0, 0],
                [1951, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 2010, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 0, 0, 0, 0, 0, 0]];

        threegases = [[2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 2004, 2008, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1951, 2000, 2005, 2010, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 2010, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0]];

        threedieseles = [[2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1960, 0, 2004, 2008, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1951, 2000, 2005, 2010, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 2010, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0],
                [2060, 0, 0, 0, 0, 0, 0, 0]];

        lhdtgases = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2003, 2004, 2010, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 2004, 2006, 2010, 2016, 2018, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        lhdtdieseles = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2001, 2004, 2008, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2003, 2008, 2011, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        mhdtgases = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2003, 2004, 2010, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2004, 2011, 0, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        mhdtdieseles = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2001, 2004, 2008, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2003, 2008, 2011, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        hhdtgases = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2003, 2004, 2010, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2004, 2011, 0, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];

        hhdtdieseles = [[1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1992, 0, 1994, 0, 0, 2007, 0],
                [1960, 1993, 0, 1994, 0, 0, 0, 0],
                [1960, 1996, 2000, 2006, 0, 2012, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 1992, 1997, 2001, 2006, 2009, 2014, 0],
                [1960, 1996, 2006, 2008, 2013, 2016, 0, 0],
                [1960, 2000, 2010, 2015, 0, 0, 0, 0],
                [1960, 2001, 2004, 2008, 2013, 0, 0, 0],
                [1960, 1994, 1997, 2005, 2007, 0, 2010, 0],
                [1960, 2000, 2005, 2010, 0, 0, 0, 0],
                [1960, 1995, 1998, 2002, 2006, 2010, 2015, 0],
                [1960, 1996, 0, 2003, 2008, 2011, 0, 0],
                [1960, 2005, 2015, 0, 0, 0, 0, 0],
                [1960, 2000, 0, 0, 0, 0, 0, 0],
                [1960, 2005, 0, 0, 0, 0, 0, 0]];
    }
    
    //Takes the separate emission standard year-of-implementation tables and structures them in the vehiclees object
    function vehicleesCalc(es1, es2) {
        for (k = 0; k < (len3 - 1); k++) {
            vehicleesyear[vehicleList[i]][fuelList[0]][regionList[k]] = es1[k];
            vehicleesyear[vehicleList[i]][fuelList[1]][regionList[k]] = es2[k];
        }
    }
    
    //Establishes the data structures
    function dataInit() {
        globalvktpctbyage = new VehicleObj();
        globalvkt = new VehicleObj();
        globalemissions = new VehicleObj();
        vehicleesyear = new VehicleObj();
        globalvktbystd = new VehicleObj();
        
        len = vehicleList.length;
        len2 = fuelList.length;
        len3 = regionList.length;
        
        for (i = 0; i < len; i++) {
            globalvktpctbyage[vehicleList[i]] = new RegionObj();
            globalvkt[vehicleList[i]] = new FuelObj();
            globalemissions[vehicleList[i]] = new FuelObj();
            vehicleesyear[vehicleList[i]] = new FuelObj();
            globalvktbystd[vehicleList[i]] = new FuelObj();
        }
        
        len4 = 51;
        for (i = 0; i < len; i++) {
            for (j = 0; j < len2; j++) {
                for (k = 0; k < len3; k++) {
                    for (m = 0; m < len4; m++) {
                        globalemissions[vehicleList[i]][fuelList[j]][regionList[k]][m] = new Emissions2();
                        globalvktbystd[vehicleList[i]][fuelList[j]][regionList[k]][m] = [0, 0, 0, 0, 0, 0, 0, 0];
                    }
                }
            }
        }
        
        vehicleef = new VehicleObj();
        
        vehicleefInit();
        esInit();
        
        for (i = 0; i < len; i++) {
            switch (i) {
            case 0:
                vehicleesCalc(ldvgases, ldvdieseles);
                break;
            case 1:
                vehicleesCalc(busgases, busdieseles);
                break;
            case 2:
                vehicleesCalc(twogases, twodieseles);
                break;
            case 3:
                vehicleesCalc(threegases, threedieseles);
                break;
            case 4:
                vehicleesCalc(lhdtgases, lhdtdieseles);
                break;
            case 5:
                vehicleesCalc(mhdtgases, mhdtdieseles);
                break;
            case 6:
                vehicleesCalc(hhdtgases, hhdtdieseles);
                break;
            }
        }
    }
    
    //Calculates the data points. Automatically bases emission values on the selected country & pollutant
    /*function calc(q) {
        sum = 0;
        len = globalvktpctbyage[vehicle][region].length;
        m = euvidate - 2000;
        for (i = 0; i < len; i++) {
            if (i < (q - m)) {
                sum += vehicleef[vehicle][fuel][pollutant].Euro6 * globalvkt[vehicle][fuel][region][q].toFixed(6) * globalvktpctbyage[vehicle][region][i].toFixed(6);
            } else {
                sum += vehicleef[vehicle][fuel][pollutant].Uncontrolled * globalvkt[vehicle][fuel][region][q].toFixed(6) * globalvktpctbyage[vehicle][region][i].toFixed(6);
            }
        }
        sum = sum.toFixed(2);
        return (sum);
    }*/

    //For when the mouse moves off of the chart overlay area.
    function mouseout() {
        focus.style("display", "none");
        chart.select(".xlegend").text("Year");
        chart.select(".ylegend").text(pollutant + " Emissions (ktons)");
    }

    //For when the mouse moves around the chart. It gets the mouse position & computes the nearest X value and corresponding Y value.
    function mousemove() {
        var x0 = x.invert(d3.mouse(this)[0]), //d3.mouse(this)[0] is the x-value of the mouse, [1] is the y-value.
            i = bisectDate(data, x0, 1),
            d0 = data[i - 1],
            d1 = data[i],
            d = x0 - d0.Horiz > d1.Horiz - x0 ? d1 : d0; //Not sure how this works, but it does.
        focus.attr("transform", "translate(" + x(d.Horiz) + "," + y(d.Vertic) + ")"); //Moves circle
        focus.select("text").text(d.Vertic); //Adds text to focus circle
        chart.select(".xlegend").text("Year: " + dateToYear(d.Horiz)); //Adds year to x legend
        chart.select(".ylegend").text(pollutant + " Emissions (ktons): " + d.Vertic); //Adds emissions to y legend
    }

    //Creates and draws the line graph (after erasing any previous graph)
    function lineUpdate() {
        //Removes existing graphlines
        //chart.select(".graphline").remove();

        //For computing the line
        lineFunc = d3.svg.line()
            .x(function (d) { return x(d.Horiz); })
            .y(function (d) { return y(d.Vertic); })
            .interpolate('linear'); //spiky instead of curvy line (use basis for curvy)
        
        len = data.length;
        for (j = 0; j < len; j++) {
            demain[j] = +data[j].Vertic;
        }
        
        //For adding the line
        chart.append('svg:path')
            .attr('class', 'graphline').attr('stroke', 'steelblue') //Need to figure out how to indicate data vs. model
            .attr('stroke-width', 2)
            .attr('fill', 'none');
        chart.transition().duration(750).select(".graphline").attr('d', lineFunc(data));
            
        y.domain([0, d3.max(demain)]);
        
        chart.transition().duration(750).transition().select(".graphline").attr('d', lineFunc(data));
        chart.transition().duration(750).transition().select(".y.axis").call(yAxis);
            
    }

    function chartChange() {
        dataRecalc();
        /*
        len = data.length;
        for (j = 0; j < len; j++) {
            demain[j] = +data[j].Vertic;
        }
        y.domain([0, d3.max(demain)]);
        chart.select(".y.axis").transition().duration(750).call(yAxis);*/
        lineUpdate();
        
    }

    function regionChange() {
        region = this.value;
        chart.select(".regionname").text("Region: " + region);
        chartChange();
    }

    function pollutantChange() {
        pollutant = this.value;
        chart.select(".ylegend").text(pollutant + " Emissions (ktons)");
        chartChange();
    }

    function fuelChange() {
        fuel = this.value;
        chartChange();
    }

    function vehicleChange() {
        vehicle = this.value;
        chartChange();
    }
    
    function formtypeInit(selector, list, change) {
        len = list.length;
        for (i = 0; i < len; i++) {
            d3.select("#" + selector + "select")
                .append("label")
                .attr("id", list[i])
                .append("input")
                .attr("type", "radio")
                .attr("name", selector)
                .attr("id", selector + i)
                .attr("value", list[i])
                .on("change", change);
            d3.select("#" + list[i]).append("text").text(" " + list[i]).append("br");
        }
    }
        
    function formInit() {
        formtypeInit("region", regionList, regionChange);
        formtypeInit("pollutant", pollutantList, pollutantChange);
        formtypeInit("vehicle", vehicleList, vehicleChange);
        formtypeInit("fuel", fuelList, fuelChange);
                     
        d3.select("#region8").property("checked", true);
        d3.select("#pollutant5").property("checked", true);
        d3.select("#vehicle6").property("checked", true);
        d3.select("#fuel1").property("checked", true);

    }

    function sliderInit() {
        $("#slider1").slider({
            min: 2000,
            max: 2050,
            value: 2025,
            slide: function (event, ui) {
                euvidate = ui.value;
                d3.select("#counter").text(ui.value);
                //dataRecalc();
                lineUpdate();
            }
            //change: function (event, ui) {
                //Update the Y-axis here, so that it only updates when the slider is done being moved
                //Also update the Y-axis on regionChange and pollutantChange
            //}
        });

        d3.select(".top")
            .append("svg")
            .attr("width", 50)
            .attr("height", 25)
            .append("text")
            .attr("id", "counter")
            .attr("y", 5)
            .attr("dy", ".71em")
            .text(euvidate);
    } //old?

    function chartInit() {
        //sets the value range (domain) of the x-axis
        x.domain([years[0], years[(years.length - 1)]]);

        //sets the value range (domain) of the y-axis
        len = data.length;
        for (j = 0; j < len; j++) {
            demain[j] = +data[j].Vertic;
        }
        y.domain([0, d3.max(demain)]);
        //y.domain(d3.extent(demain));

        //To move xAxis to desired location & call it:
        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")") //Moves it down to the bottom of the graph.
            .call(xAxis)
            .append("text")
            .attr("class", "xlegend")  //So it can be called again. May need to change to id for later graphs
            .attr("x", width - 10) // moves it out from the origin, -10 keeps it from going too far
            .attr("y", -5) // moves it up above the x-axis (inverted y scale for svg)
            .attr("dx", ".71em")  //Sets width of x axis legend text. em is a relative value, proportional to browser default size (14px?)
            .style("text-anchor", "end")  //Anchors the text to the end of the axis
            .text("Year");

        //For adding the Y axis
        chart.append("g")
            .attr("class", "y axis")
            .call(yAxis)

        //For adding the Y axis legend
        //Same sort of stuff as X axis
            .append("text")
            .attr("class", "ylegend")
            .attr("y", -40)
            .attr("x", 0)
            .attr("dy", ".71em")
            .style("text-anchor", "start")
            .text(pollutant + " Emissions (ktons)");

        //For adding the region name
        chart.append("text")
            .attr("class", "regionname")
            .attr("y", -35)
            .attr("x", width - 160)
            .attr("dy", ".71em")
            .text("Region: " + region);

        //Creates the tracking circle
        focus = chart.append("g")
            .attr("class", "focus") //The variable is called focus, and also has a class of focus.
            .style("display", "none"); //Does not display initially

        focus.append("circle")  //Creates the circle
            .attr("r", 4.5);

        //Creates location for text to go.
        focus.append("text")
            .attr("x", -10)
            .attr("y", -15)
            .attr("dy", ".35em");

        //Adds a rectangular overlay on top of the chart to detect mouse events
        chart.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function () { focus.style("display", null); })
            .on("mouseout", mouseout)
            .on("mousemove", mousemove);
    }
    
    function initVKTchart() {
        margin = {top: 50, right: 30, bottom: 30, left: 40};
        width = $(document).width();
        width = 0.35 * width - margin.left - margin.right;
        height = 250 - margin.top - margin.bottom;

        x2 = d3.time.scale()
            .range([0, width]); //sets the pixel range of the x-axis

        y2 = d3.scale.linear()
            .range([height, 0]); //sets the pixel range of the y-axis

        xAxis2 = d3.svg.axis()
            .scale(x2)
            .orient("bottom")
            .ticks(5);

        yAxis2 = d3.svg.axis()
            .scale(y2)
            .orient("left")
            .ticks(5);

        vktchart = d3.select("#vktchart")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        //sets the value range (domain) of the x-axis
        x2.domain([years[0], years[(years.length - 1)]]);
        //sets the value range (domain) of the y-axis
        len = data2.length;
        for (j = 0; j < len; j++) {
            demain[j] = +data2[j].Vertic;
        }
        y2.domain([0, d3.max(demain)]);
        //y.domain(d3.extent(demain));

        //To move xAxis to desired location & call it:
        vktchart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")") //Moves it down to the bottom of the graph.
            .call(xAxis2)
            .append("text")
            .attr("class", "xlegend")  //So it can be called again. May need to change to id for later graphs
            .attr("x", width - 10) // moves it out from the origin, -10 keeps it from going too far
            .attr("y", -5) // moves it up above the x-axis (inverted y scale for svg)
            .attr("dx", ".71em")  //Sets width of x axis legend text. em is a relative value, proportional to browser default size (14px?)
            .style("text-anchor", "end")  //Anchors the text to the end of the axis
            .text("Year");

        //For adding the Y axis
        vktchart.append("g")
            .attr("class", "y2 axis")
            .call(yAxis2)
            .append("text")
            .attr("class", "ylegend")
            .attr("y", -40)
            .attr("x", 0)
            .attr("dy", ".71em")
            .style("text-anchor", "start")
            .text("VKT at Euro 6");
            
        //For adding the region name
        vktchart.append("text")
            .attr("class", "regionname")
            .attr("y", -35)
            .attr("x", width - 160)
            .attr("dy", ".71em")
            .text("Region: " + region);

        //Creates the tracking circle
        focus2 = vktchart.append("g")
            .attr("class", "focus") //The variable is called focus, and also has a class of focus.
            .style("display", "none"); //Does not display initially

        focus2.append("circle")  //Creates the circle
            .attr("r", 4.5);

        //Creates location for text to go.
        focus2.append("text")
            .attr("x", -10)
            .attr("y", -15)
            .attr("dy", ".35em");

        //Adds a rectangular overlay on top of the vktchart to detect mouse events
        vktchart.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function () { focus2.style("display", null); })
            .on("mouseout", function () { focus2.style("display", "none");});
            //.on("mousemove", mousemove);
        
        //For computing the line
        linefunc2 = d3.svg.line()
            .x(function (d) { return x2(d.Horiz); })
            .y(function (d) { return y2(d.Vertic); })
            .interpolate('linear'); //spiky instead of curvy line (use basis for curvy)

        //For adding the line
        vktchart.append('svg:path')
            .attr('class', 'graphline')
            .attr('d', linefunc2(data2))
            .attr('stroke', 'steelblue') //Need to figure out how to indicate data vs. model
            .attr('stroke-width', 2)
            .attr('fill', 'none');
    }
    
    function vktPctByAge(ldv, hdt, mc, share) {
        globalvktpctbyage.LDV[regionList[k]][i] = +share[i][ldv];
        globalvktpctbyage.Bus[regionList[k]][i] = +share[i][hdt];
        globalvktpctbyage.TwoWheeler[regionList[k]][i] = +share[i][mc];
        globalvktpctbyage.ThreeWheeler[regionList[k]][i] = +share[i][mc];
        globalvktpctbyage.LHDT[regionList[k]][i] = +share[i][hdt];
        globalvktpctbyage.MHDT[regionList[k]][i] = +share[i][hdt];
        globalvktpctbyage.HHDT[regionList[k]][i] = +share[i][hdt];
    }
    
    function allFuelVKT(fuelvkt) {
        for (k = 0; k < len2; k++) {
            for (j = 0; j < (len3 - 1); j++) {
                globalvkt[vehicleList[i]].AllFuels[regionList[j]][k] = +fuelvkt[k][regionList[j]];
                sum += globalvkt[vehicleList[i]].AllFuels[regionList[j]][k];
            }
            globalvkt[vehicleList[i]].AllFuels.Global[k] = sum;
            sum = 0;
        }
    }
    
    function fuelVKT(fueltype, vehicletype) {
        for (k = 0; k < len2; k++) {
            for (j = 0; j < (len3 - 1); j++) {
                globalvkt[vehicleList[i]][fueltype][regionList[j]][k] = vehicletype[k][regionList[j]] * globalvkt[vehicleList[i]].AllFuels[regionList[j]][k];
                sum += globalvkt[vehicleList[i]][fueltype][regionList[j]][k];
            }
            globalvkt[vehicleList[i]][fueltype].Global[k] = sum;
            sum = 0;
        }
    }
    
    function fuelSum(fueltype) {
        for (k = 0; k < len2; k++) {
            for (j = 0; j < len3; j++) {
                for (i = 0; i < (len - 1); i++) {
                    sum += globalvkt[vehicleList[i]][fueltype][regionList[j]][k];
                }
                globalvkt.AllVehicles[fueltype][regionList[j]][k] = sum;
                sum = 0;
            }
        }
    }
    
    function fleetEF(year) {
        sum = 0;
        
        //Check this calculation
        for (p = 0; p < len6; p++) {
            yearproduced = (year - p) + 2000;
            index = 0;
            while ((yearproduced > vehicleesyear[vehicleList[i]][fuelList[j]][regionList[k]][index]) && (vehicleesyear[vehicleList[i]][fuelList[j]][regionList[k]][index] !== 0)) {
                index++;
            }
            sum += vehicleef[vehicleList[i]][fuelList[j]][pollutantList[n]][standardList[index]] * globalvktpctbyage[vehicleList[i]][regionList[k]][p];
        }
        return sum;
    }
    
    function fleetVKTbystd(year) {
        //Check this calculation
        for (p = 0; p < len6; p++) {
            yearproduced = (year - p) + 2000;
            index = 0;
            while ((yearproduced > vehicleesyear[vehicleList[i]][fuelList[j]][regionList[k]][index]) && (vehicleesyear[vehicleList[i]][fuelList[j]][regionList[k]][index] !== 0)) {
                index++;
            }
            globalvktbystd[vehicleList[i]][fuelList[j]][regionList[k]][m][index] += globalvkt[vehicleList[i]][fuelList[j]][regionList[k]][m] * globalvktpctbyage[vehicleList[i]][regionList[k]][p];
        }
    }
    
    function resize() {
        d3.selectAll("#emissionschart").selectAll("g").remove();
        
        drawCharts("emissionschart", 0.55);
        chartInit();
        lineUpdate();
        //repeat for other charts
    }
    //End Helper Functions
    //****************************************************************************************//


    //Program Core
    //****************************************************************************************//
    d3.csv("http://bgould132.github.io/csv/VKT Share by Age.csv", function (error, vktshare) {
        chart = d3.select("#emissionschart");
        
        dataInit();
        
        len = vktshare.length; //i
        len2 = regionList.length; //k
        len3 = vehicleList.length; //j
        
        for (i = 0; i < len; i++) {
            sum = 0;
            for (k = 0; k < (len2 - 1); k++) {
                sum = 0;
                switch (regionList[k]) {
                case "China":
                    vktPctByAge("China LDV", "China HDT", "MCs", vktshare);
                    break;
                case "India":
                    vktPctByAge("India LDV", "India HDT", "India MCs", vktshare);
                    break;
                case "LA-31":
                    vktPctByAge("Brazil LDV", "Brazil HDT", "MCs", vktshare);
                    break;
                case "Brazil":
                    vktPctByAge("Brazil LDV", "Brazil HDT", "MCs", vktshare);
                    break;
                case "Canada":
                    vktPctByAge("Canada LDV", "U.S. HDT", "MCs", vktshare);
                    break;
                case "Mexico":
                    vktPctByAge("Mexico LDV", "U.S. HDT", "MCs", vktshare);
                    break;
                default:
                    vktPctByAge("U.S. LDV", "U.S. HDT", "MCs", vktshare);
                    break;
                }
            }
        }
        
        for (i = 0; i < len; i++) {
            for (k = 0; k < len2 - 1; k++) {
                sum = 0;
                for (j = 0; j < len3 - 1; j++) {
                    sum += globalvktpctbyage[vehicleList[j]][regionList[k]][i];
                }
                globalvktpctbyage.AllVehicles[regionList[k]][i] = sum / 7;
            }
        }
        
        for (i = 0; i < len; i++) {
            for (j = 0; j < len3; j++) {
                globalvktpctbyage[vehicleList[j]].Global[i] = 0; // Values have to be initialized to 0 before += will work.
            }
            for (k = 0; k < (len2 - 1); k++) {
                for (j = 0; j < len3; j++) { // Loops through all vehicles and regions, getting the avg vktpctbyage for that age
                    globalvktpctbyage[vehicleList[j]].Global[i] += globalvktpctbyage[vehicleList[j]][regionList[k]][i] / (len2 - 1);
                }   //Averaging by number of regions (instead of number of vehicles) may introduce (relatively minor) inaccuracies
            }
        }
            
        d3.csv("http://bgould132.github.io/csv/LDV VKT by Country.csv", function (error, ldvvkt) {
            d3.csv("http://bgould132.github.io/csv/Bus VKT by Country.csv", function (error, busvkt) {
                d3.csv("http://bgould132.github.io/csv/TwoWheeler VKT by Country.csv", function (error, twovkt) {
                    d3.csv("http://bgould132.github.io/csv/ThreeWheeler VKT by Country.csv", function (error, threevkt) {
                        d3.csv("http://bgould132.github.io/csv/LHDT VKT by Country.csv", function (error, lhdtvkt) {
                            d3.csv("http://bgould132.github.io/csv/MHDT VKT by Country.csv", function (error, mhdtvkt) {
                                d3.csv("http://bgould132.github.io/csv/HHDT VKT by Country.csv", function (error, hhdtvkt) {
                                    d3.csv("http://bgould132.github.io/csv/LDV Gasoline Pct.csv", function (error, ldvgas) {
                                        d3.csv("http://bgould132.github.io/csv/Bus Gasoline Pct.csv", function (error, busgas) {
                                            d3.csv("http://bgould132.github.io/csv/TwoWheeler Gasoline Pct.csv", function (error, twogas) {
                                                d3.csv("http://bgould132.github.io/csv/ThreeWheeler Gasoline Pct.csv", function (error, threegas) {
                                                    d3.csv("http://bgould132.github.io/csv/LHDT Gasoline Pct.csv", function (error, lhdtgas) {
                                                        d3.csv("http://bgould132.github.io/csv/MHDT Gasoline Pct.csv", function (error, mhdtgas) {
                                                            d3.csv("http://bgould132.github.io/csv/HHDT Gasoline Pct.csv", function (error, hhdtgas) {
                                                                d3.csv("http://bgould132.github.io/csv/LDV Diesel Pct.csv", function (error, ldvdiesel) {
                                                                    d3.csv("http://bgould132.github.io/csv/Bus Diesel Pct.csv", function (error, busdiesel) {
                                                                        d3.csv("http://bgould132.github.io/csv/TwoWheeler Diesel Pct.csv", function (error, twodiesel) {
                                                                            d3.csv("http://bgould132.github.io/csv/ThreeWheeler Diesel Pct.csv", function (error, threediesel) {
                                                                                d3.csv("http://bgould132.github.io/csv/LHDT Diesel Pct.csv", function (error, lhdtdiesel) {
                                                                                    d3.csv("http://bgould132.github.io/csv/MHDT Diesel Pct.csv", function (error, mhdtdiesel) {
                                                                                        d3.csv("http://bgould132.github.io/csv/HHDT Diesel Pct.csv", function (error, hhdtdiesel) {
                                                                                            len = vehicleList.length; //i
                                                                                            len2 = ldvvkt.length; //k
                                                                                            len3 = regionList.length; //j

                                                                                            for (i = 0; i < (len - 1); i++) {
                                                                                                sum = 0;
                                                                                                switch (i) {
                                                                                                case 0:
                                                                                                    allFuelVKT(ldvvkt);
                                                                                                    fuelVKT("Gasoline", ldvgas);
                                                                                                    fuelVKT("Diesel", ldvdiesel);
                                                                                                    break;
                                                                                                case 1:
                                                                                                    allFuelVKT(busvkt);
                                                                                                    fuelVKT("Gasoline", busgas);
                                                                                                    fuelVKT("Diesel", busdiesel);
                                                                                                    break;
                                                                                                case 2:
                                                                                                    allFuelVKT(twovkt);
                                                                                                    fuelVKT("Gasoline", twogas);
                                                                                                    fuelVKT("Diesel", twodiesel);
                                                                                                    break;
                                                                                                case 3:
                                                                                                    allFuelVKT(threevkt);
                                                                                                    fuelVKT("Gasoline", threegas);
                                                                                                    fuelVKT("Diesel", threediesel);
                                                                                                    break;
                                                                                                case 4:
                                                                                                    allFuelVKT(lhdtvkt);
                                                                                                    fuelVKT("Gasoline", lhdtgas);
                                                                                                    fuelVKT("Diesel", lhdtdiesel);
                                                                                                    break;
                                                                                                case 5:
                                                                                                    allFuelVKT(mhdtvkt);
                                                                                                    fuelVKT("Gasoline", mhdtgas);
                                                                                                    fuelVKT("Diesel", mhdtdiesel);
                                                                                                    break;
                                                                                                case 6:
                                                                                                    allFuelVKT(hhdtvkt);
                                                                                                    fuelVKT("Gasoline", hhdtgas);
                                                                                                    fuelVKT("Diesel", hhdtdiesel);
                                                                                                    break;
                                                                                                }
                                                                                            }
                                                                                            
                                                                                            fuelSum("AllFuels");
                                                                                            fuelSum("Gasoline");
                                                                                            fuelSum("Diesel");

                                                                                            //Sets up years array, aka x-axis
                                                                                            len = globalvkt[vehicleList[0]].Diesel[regionList[0]].length;
                                                                                            for (i = 0; i < len; i++) {
                                                                                                years[i] = parseDate("1-Jan-" + (i + 2000).toString());
                                                                                            }
                                                                                            
                                                                                            formInit();
                                                                                            dataCalc();
                                                                                            dataRecalc();
                                                                                            
                                                                                            initVKTchart();
                                                                                            
                                                                                            drawCharts("emissionschart", 0.55);
                                                                                            chartInit();
                                                                                            lineUpdate();
                                                                                            
                                                                                            
                                                                                        });
                                                                                    });
                                                                                });
                                                                            });
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }); // closing tag for d3.csv("Global VKT Share by Age.csv")
    
    d3.select(window).on('resize', resize);

/*Debugging tool: 
        d3.select(".debug").text(globalHHDTVKTpctbyage[0]["Brazil"]); //debug
*/
}());

