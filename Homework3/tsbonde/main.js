//INTERACTION SUMMARY FOR MY VISUALIZATION:
//Parallel COrrdinate Plot: BRUSHING -> (select and drag anywhere on any vertical axis to look at specific connections)

//BAR CHART: TRANSITION -> drop down menu allows you do switch between different bar views (they fade and animate)

//HEATMAP: SELECTION -> when you hover over any column all cells within that column will highlight
//In addition, when you hover over any cell it will display the job count

//Define the tooltip configurations that will show on hover
// This is initially hidden 
const tooltip = d3.select("body")
  .append("div")
  .style("position", "absolute")
  .style("background-color", "black")
  .style("color", "white")
  .style("padding", "5px")
  .style("border-radius", "4px")
  .style("font-size", "12px")
  .style("pointer-events", "none")
  .style("opacity", 0);

const margin = { top: 40, right: 80, bottom: 70, left: -60 },
      width = 1170 - margin.left - margin.right,
      height = window.innerHeight - margin.top - margin.bottom;
//Declare all the margin information & height & width

//Set up the main svg container where our visualization will be stored
const svg = d3.select("body") // Select the body element
  .append("svg") // Append an SVG element
  .attr("width", width + margin.left + margin.right + 400) // Total width including margins
  .attr("height", height + margin.top + margin.bottom) // Total height including margins
  .style("position", "absolute") // Position the SVG absolutely
  .style("left", "-50px") // Shift SVG slightly to the left
  .style("top", `${margin.top}px`) // Position it down from the top of the page
  .append("g") // Append a group element inside the SVG
  .attr("transform", `translate(${margin.left},${margin.top})`); // Shift group to respect margins

svg.append("text")
  .attr("x", (width + margin.left + margin.right) / 2) // center horizontally
  .attr("y", -margin.top / 1.5) // place above the plot (adjust as needed)
  .attr("text-anchor", "middle") // center align the text
  .style("font-size", "14px")
  .style("font-weight", "bold")
  .text("Parallel Coordinates Plot of Data Science Job Salaries");

//Get all the info from the dataset that we will be needing
const dimensions = [
  "experience_level",
  "employment_type",
  "salary_in_usd",
  "remote_ratio",
  "company_location",
  "company_size"
];

const y = {};

const x = d3.scalePoint()
  .range([0, width])
  .padding(1)
  .domain(dimensions);

d3.csv("ds_salaries.csv").then(data => {
  
  // Color scale
  // Create an X-axis scale using d3.scalePoint for positioning each axis in the parallel coordinates plot
  // This is used to color the lines in the parallel coordinates plot
  const colorScale = d3.scaleOrdinal()
    .domain([...new Set(data.map(d => d.experience_level))])
    .range(d3.schemeSet2);

  // Color scale for "employment_type" (bars)
  const employmentTypes = [...new Set(data.map(d => d.employment_type))];
  const colorScaleEmployment = d3.scaleOrdinal()
    .domain(employmentTypes)
    // Use a predefined D3 color scheme
    .range(d3.schemeSet2); 

  // Set up scales for each dimension
  dimensions.forEach(dim => {
    if (["salary_in_usd", "remote_ratio"].includes(dim)) {
      y[dim] = d3.scaleLinear()
        .domain(d3.extent(data, d => +d[dim])) // Get min and max values
        .range([height, 0]);
    } else {
      const domain = [...new Set(data.map(d => d[dim]))];
      // Use a point scale for categorical dimensions
      y[dim] = d3.scalePoint()
        .domain(domain)
        .range([height, 0]);
    }
  });

  //Draw each line going through each axis representing one data record
  // Wanna map through all the different dimensions we have 
  function path(d) {
    return d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
  }

  //Draw all the background lines (want this to be visually easy on the eyes)
  svg.selectAll("path.background")
    .data(data)
    .enter().append("path")
    .attr("class", "background")
    .attr("d", path)
    .style("fill", "none")
    .style("stroke", "#eee")
    .style("opacity", 0.3);

  //Draw the foreground
  // Color base on the experience level (to highlight in our overview parallel plot) and using colorscale
  const foreground = svg.selectAll("path.foreground")
    .data(data)
    .enter().append("path")
    .attr("class", "foreground")
    .attr("d", path)
    .style("fill", "none")
    .style("stroke", d => colorScale(d.experience_level)) // colored lines
    .style("opacity", 0.7);

  //For each of the dimensions get a svg group element
  //It will hold things like axis lines, labels, and backgrounds
  const g = svg.selectAll(".dimension")
    .data(dimensions)
    .enter().append("g")
    .attr("class", "dimension")
    .attr("transform", d => `translate(${x(d)})`);                                  
  //Add the background rectangles
  g.append("rect")
    .attr("x", -40)
    .attr("y", -30)
    .attr("width", 80)
    .attr("height", height + 60)
    .attr("fill", "white")
    .attr("opacity", d => d === "company_location" ? 0.6 : 0)
    .lower();
  //Add the axis and axis labels
  g.append("g")
    .each(function(d) {
      const axis = d3.axisLeft(y[d]);
      d3.select(this).call(axis);
    })
    .append("text")
    .style("text-anchor", "middle")
    .attr("y", -9)
    //Replace the underscores for the axis titles 
    .text(d => d.replace(/_/g, " "))
    .style("fill", "black");

    // Add brushing functionality for interactive filtering
const brushes = {};  // To keep track of active brushes

// For each axis group (g), add a vertical brush component
g.append("g")
  .attr("class", "brush")
  .each(function(d) {
    // Call the brush on this
    d3.select(this).call(
      brushes[d] = d3.brushY()
      // get the clickable/drag area of the brush
        .extent([[-10, 0], [10, height]])
        // Attach brush event handler (on brush or end)
        .on("brush end", brush)
    );
  });

  /**
 * Brush event handler – called whenever a brush is moved or released
 * Filters the visible lines based on which regions are selected on each axis
 */

  function brush(event) {
    const actives = [];
  
    // Collect all active brush selections
    svg.selectAll(".brush")
      .each(function(dimension) {
        const brushSelection = d3.brushSelection(this);
        if (brushSelection) {
          actives.push({
            dimension,
            extent: brushSelection
          });
        }
      });
  
    // Apply fast and drastic fading: keep only matching lines at opacity 1, fade others to 0
    // fade lines that do not match the active brush criteria
    foreground.transition().duration(50)
      .style("opacity", function(d) {
        // No filters applied: show all lines
        if (actives.length === 0) return 1.0;
  
        // Check if this data line passes ALL active filters
        const isVisible = actives.every(active => {
          const dim = active.dimension;
          const extent = active.extent;
          const value = y[dim](d[dim]); // Get Y-coordinate (in pixels) for this dimension's value
          return value >= extent[0] && value <= extent[1];
        });
        // Show or hide line accordingly
        return isVisible ? 1.0 : 0.0; // Full visibility or fully invisible
      });
  }
  
  // BAR CHART
  const barMargin = { top: 40, right: 40, bottom: 60, left: 60 };
  const barWidth = 300;
  const barHeight = 300;

  // Group data by employment_type and calculate average salary
  // Group the CSV data by employment type and calculate the average salary in USD for each group
  const salaryByEmployment = Array.from(
    //Group data by 'employment_type'
    d3.group(data, d => d.employment_type),
    //For each group, return an object
    ([key, values]) => ({
      employment_type: key,
      avg_salary: d3.mean(values, d => +d.salary_in_usd)
    })
  );


  const barX = d3.scaleBand()
  // Each bar represents an employment type
    .domain(salaryByEmployment.map(d => d.employment_type))
    // Full width of the bar chart
    .range([0, barWidth])
    // Space between bars
    .padding(0.2);

// Y SCALE (for bar height)
// Converts average salary values to vertical pixel positions on the chart.
// Since SVG has (0,0) at the top-left, the higher the salary, the lower the y-coordinate must be (in pixels)
  const barY = d3.scaleLinear()
    .domain([0, d3.max(salaryByEmployment, d => d.avg_salary)])
    .nice()
    .range([barHeight, 0]);
  //Make a bar chart group to hold the position
  const barChartGroup = svg.append("g")
    .attr("transform", `translate(${width + 30}, ${margin.top - 40})`); //controls left/right alignment & up or down

  // X Axis
  // Append a new element to the existing SVG to contain all bar chart elements like axes, bars, labels
  barChartGroup.append("g")
    .attr("transform", `translate(0,${barHeight})`)
    .call(d3.axisBottom(barX))
    .selectAll("text")
    .style("font-size", "12px");
  
  // X-axis Label
  barChartGroup.append("text")
    .attr("x", barWidth / 2)
    .attr("y", barHeight + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Employment Type");

  // Y Axis
  barChartGroup.append("g")
    .call(d3.axisLeft(barY).ticks(5));

  // BAR CHART
  barChartGroup.selectAll(".bar")
    .data(salaryByEmployment)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => barX(d.employment_type))
    .attr("y", d => barY(d.avg_salary))
    .attr("width", barX.bandwidth())
    .attr("height", d => barHeight - barY(d.avg_salary))
    .attr("fill", d => colorScaleEmployment(d.employment_type)); // <- colored by employment_type

  // Get the Title
  barChartGroup.append("text")
    .attr("x", barWidth / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text("Average Salary by Employment Type");

  // Y-axis Label
  barChartGroup.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -barHeight / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Avg Salary (USD)");

  // Move the bar legend above the bars inside the bar chart area (upper right white space)
  const barLegend = svg.append("g")
  .attr("class", "bar-color-legend")
  .attr("transform", `translate(${width + 300}, ${margin.top + 3})`); // moved right and a little down

//Attributes for the bar legend
barLegend.selectAll("rect")
  .data(employmentTypes)
  .enter().append("rect")
  .attr("x", 0)
  .attr("y", (d, i) => i * 20)
  .attr("width", 14)
  .attr("height", 14)
  .style("fill", d => colorScaleEmployment(d));

barLegend.selectAll("text")
  .data(employmentTypes)
  .enter().append("text")
  .attr("x", 20)
  .attr("y", (d, i) => i * 20 + 11)
  .text(d => d)
  .style("font-size", "12px");


// Give the x-axis group a class for easier selection

const xAxisGroup = barChartGroup.append("g")
  .attr("class", "x-axis")
  // Move the axis to the bottom of the chart area
  .attr("transform", `translate(0,${barHeight})`)
  // Use the bottom axis generator with the previously defined barX scale
  .call(d3.axisBottom(barX))
  .selectAll("text")
  .style("font-size", "12px");

// Instead, append only the axis label text after appending the axis group
barChartGroup.append("text")
  .attr("x", barWidth / 2)
  .attr("y", barHeight + 40)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Employment Type");

// Experience levels (for grouping)
const experienceLevels = Array.from(new Set(data.map(d => d.experience_level)));

// Group color scale for experience levels
const colorScaleExperience = d3.scaleOrdinal()
  .domain(experienceLevels)
  .range(d3.schemeSet2);

// Redraw based on selected view
d3.select("#viewSelector").on("change", function () {
  const selectedView = d3.select(this).property("value");
  updateBarChart(selectedView);
});

// Initial view
updateBarChart("univariate");

function updateBarChart(viewType) {
    
    if (viewType === "univariate") {
      // Univariate: Average salary by employment_type
      // Hide tooltip for univariate view
      tooltip.style("opacity", 0);
      const salaryByEmployment = Array.from(
        // Group raw data by employment type
        d3.group(data, d => d.employment_type),
        ([key, values]) => ({
          employment_type: key,
          // Calculate average salary for the group
          avg_salary: d3.mean(values, d => +d.salary_in_usd)
        })
      );
  
      // // Update the domain of the x-axis based on employment type categories
      barX.domain(salaryByEmployment.map(d => d.employment_type));
      barY.domain([0, d3.max(salaryByEmployment, d => d.avg_salary)]).nice();
  
      // Update X axis
      //Select the existing x-axis group
      barChartGroup.select(".x-axis")
        .transition().duration(750)
        .call(d3.axisBottom(barX));
  
      // Remove any existing groups for bivariate bars smoothly
      barChartGroup.selectAll(".bar-group")
        .transition().duration(750)
        .style("opacity", 0)
        .remove();
  
      // DATA JOIN for bars (univariate)
      const bars = barChartGroup.selectAll(".bar")
        .data(salaryByEmployment, d => d.employment_type);
  
      // EXIT old bars
      bars.exit()
        .transition().duration(750)
        .attr("y", barY(0))
        .attr("height", 0)
        .style("opacity", 0)
        .remove();
  
      // UPDATE existing bars
      bars.transition().duration(750)
        .attr("x", d => barX(d.employment_type))
        .attr("y", d => barY(d.avg_salary))
        .attr("width", barX.bandwidth())
        .attr("height", d => barHeight - barY(d.avg_salary))
        .attr("fill", d => colorScaleEmployment(d.employment_type))
        .style("opacity", 1);
  
      // ENTER new bars
      bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => barX(d.employment_type))
        .attr("y", barY(0))
        .attr("width", barX.bandwidth())
        .attr("height", 0)
        .attr("fill", d => colorScaleEmployment(d.employment_type))
        .style("opacity", 0)
        .transition().duration(750)
        .attr("y", d => barY(d.avg_salary))
        .attr("height", d => barHeight - barY(d.avg_salary))
        .style("opacity", 1);
  
    } else if (viewType === "bivariate") {
      // Bivariate: Group by employment_type & experience_level
      const groupedData = Array.from(
        // clusters data by employment type
        d3.group(data, d => d.employment_type),
        ([employment_type, values]) => ({
          employment_type,
          values: Array.from(
            // Inner group-> within each employment group, further group by experience level
            d3.group(values, d => d.experience_level),
            ([experience_level, group]) => ({
              experience_level,
              // Calculate the average salary for each experience level within each employment type
              avg_salary: d3.mean(group, d => +d.salary_in_usd)
            })
          )
        })
      );

      // Update domains
      barX.domain(groupedData.map(d => d.employment_type));
      barY.domain([0, d3.max(groupedData, d => d3.max(d.values, v => v.avg_salary))]).nice();
  
      // Creates a sub-scale x1 that positions bars within each employment type group based on experience level
      const x1 = d3.scaleBand()
        .domain(experienceLevels)
        .range([0, barX.bandwidth()])
        .padding(0.05);
  
      // Update X axis
      // Update X axis on the chart with a smooth transition
      barChartGroup.select(".x-axis")
        .transition().duration(750)
        .call(d3.axisBottom(barX));
  
      // Remove univariate bars smoothly
      barChartGroup.selectAll(".bar")
        .transition().duration(750)
        .attr("y", barY(0))
        .attr("height", 0)
        .style("opacity", 0)
        .remove();
  
      // DATA JOIN for groups
      const groups = barChartGroup.selectAll(".bar-group")
      // Joins the groupedData to any existing group elements
        .data(groupedData, d => d.employment_type);
  
      // EXIT old groups
      // Smoothly fades out and removes any group elements that no longer match the data
      groups.exit()
        .transition().duration(750)
        .style("opacity", 0)
        .remove();
  
      // new groups
      // For any new employment type group in the data, create a new SVG group
    // Assigns it the class bar group for future selection
      const groupsEnter = groups.enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${barX(d.employment_type)}, 0)`)
        .style("opacity", 0);
  
      // UPDATE + ENTER groups merged selection
      const groupsMerge = groupsEnter.merge(groups);
  
      groupsMerge.transition().duration(750)
        .attr("transform", d => `translate(${barX(d.employment_type)}, 0)`)
        .style("opacity", 1);
  
      // For bars inside groups, do a nested data join
      // First remove all old bars inside groups, then add new with transitions
  
      // Remove any old rects inside groups that won't be needed
      groupsMerge.selectAll("rect")
        .data(d => d.values, d => d.experience_level)
        .join(
          enter => enter.append("rect")
            .attr("x", d => x1(d.experience_level))
            .attr("y", barY(0))
            .attr("width", x1.bandwidth())
            .attr("height", 0)
            .attr("fill", d => colorScaleExperience(d.experience_level))
            .style("opacity", 0)
            .call(enter => enter.transition().duration(750)
              .attr("y", d => barY(d.avg_salary))
              .attr("height", d => barHeight - barY(d.avg_salary))
              .style("opacity", 1)),
          update => update
            .call(update => update.transition().duration(750)
              .attr("x", d => x1(d.experience_level))
              .attr("y", d => barY(d.avg_salary))
              .attr("width", x1.bandwidth())
              .attr("height", d => barHeight - barY(d.avg_salary))
              .attr("fill", d => colorScaleExperience(d.experience_level))
              .style("opacity", 1)),
          exit => exit.call(exit => exit.transition().duration(750)
            .attr("y", barY(0))
            .attr("height", 0)
            .style("opacity", 0)
            .remove())
        );
    }
  }
  

  // Color Legend for lines (by experience_level) 
  const legend = svg.append("g")
    .attr("class", "color-legend")
    .attr("transform", `translate(${width - 150}, ${margin.top})`);

  const legendEntries = colorScale.domain();
  legend.selectAll("rect")
    .data(legendEntries)
    .enter().append("rect")
    .attr("x", 0)
    .attr("y", (d, i) => i * 20)
    .attr("width", 14)
    .attr("height", 14)
    .style("fill", d => colorScale(d));

  legend.selectAll("text")
    .data(legendEntries)
    .enter().append("text")
    .attr("x", 20)
    .attr("y", (d, i) => i * 20 + 11)
    .text(d => d)
    .style("font-size", "12px");

 // Add the  keys below the color legend we already have 
const legendYOffset = legendEntries.length * 20 + 40;
const keyX = 0;
let line = 0;

// Add experience_level heading
legend.append("text")
  .attr("x", keyX)
  .attr("y", legendYOffset + line * 15)
  .text("Experience Level:")
  .style("font-weight", "bold")
  .style("font-size", "11px");
line++;

// Define the experience_level values
const experienceKeys = [
  "EN = Entry",
  "MI = Mid",
  "SE = Senior",
  "EX = Exec"
];
experienceKeys.forEach(k => {
  legend.append("text")
    .attr("x", keyX + 10)
    .attr("y", legendYOffset + line * 15)
    .text(k)
    .style("font-size", "11px");
  line++;
});

// Add employment type title
legend.append("text")
  .attr("x", keyX)
  .attr("y", legendYOffset + line * 15 + 5)
  .text("Employment Type:")
  .style("font-weight", "bold")
  .style("font-size", "11px");
line++;

// These are the employmentype values we wanna decode
const employmentKeys = [
  "FT = Full-time",
  "PT = Part-time",
  "CT = Contract",
  "FL = Freelance"
];
employmentKeys.forEach(k => {
  legend.append("text")
    .attr("x", keyX + 10)
    .attr("y", legendYOffset + line * 15 + 5)
    .text(k)
    .style("font-size", "11px");
  line++;
});


// HEATMAP: Job Count by Work Year & Company Size
const heatmapMargin = { top: 40, right: 40, bottom: 60, left: 100 };
const heatmapWidth = 300;
const heatmapHeight = 200;

// Get unique years and company sizes
const workYears = [...new Set(data.map(d => d.work_year))].sort();
const companySizes = [...new Set(data.map(d => d.company_size))];

// Aggregate the number of counts so it can be used for the legend and intensity of the color
const heatmapData = d3.rollups(
  data,
  v => v.length,
  d => d.work_year,
  d => d.company_size
).flatMap(([work_year, group]) =>
  group.map(([company_size, count]) => ({
    work_year,
    company_size,
    count
  }))
);

// Get the correct scales
// X-axis scale for heatmap (categorical: work years)
const heatmapX = d3.scaleBand()
  .domain(workYears)
  .range([0, heatmapWidth])
  .padding(0.05);
// Y-axis scale for heatmap (categorical: company size)
const heatmapY = d3.scaleBand()
  .domain(companySizes)
  .range([0, heatmapHeight])
  .padding(0.05);

// Color scale for the heatmap cells (sequential)
// Uses a smooth gradient interpolation between two colors:
const heatmapColor = d3.scaleSequential()
  .domain([0, d3.max(heatmapData, d => d.count)])
  .interpolator(d3.interpolateRgb("#e0f3f3", "#66c2a5"));

// Create svg group for heatmap
const heatmapGroup = svg.append("g")
  .attr("transform", `translate(${width + 20}, ${barHeight + 160})`);

heatmapGroup.selectAll()
  .data(heatmapData)
  .enter().append("rect")
  .attr("x", d => heatmapX(d.work_year))
  .attr("y", d => heatmapY(d.company_size))
  .attr("width", heatmapX.bandwidth())
  .attr("height", heatmapY.bandwidth())
  .style("fill", d => heatmapColor(d.count))
  .attr("class", d => `cell year-${d.work_year} size-${d.company_size}`)
  .append("title")
  .text(d => `${d.work_year} | Job Count: ${d.count}`);


// Axes
// Append the bottom X-axis to the heatmap group
heatmapGroup.append("g")
  .attr("transform", `translate(0,${heatmapHeight})`)
  // Move the axis group to the bottom of the heatmap
  .call(d3.axisBottom(heatmapX));

// Append the left Y-axis to the heatmap group
// Create a new group element for the Y-axis
heatmapGroup.append("g")
  .call(d3.axisLeft(heatmapY));

// For the title of the heatmap
heatmapGroup.append("text")
  .attr("x", heatmapWidth / 2)
  .attr("y", -10)
  .attr("text-anchor", "middle")
  .style("font-size", "14px")
  .style("font-weight", "bold")
  .text("Job Count by Work Year & Company Size");

// Label the X axis title
heatmapGroup.append("text")
  .attr("x", heatmapWidth / 2)
  .attr("y", heatmapHeight + 40)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Work Year");

// Label the Y axis title
heatmapGroup.append("text")
  .attr("transform", `translate(-30, ${heatmapHeight / 2}) rotate(-90)`)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Company Size");

// Make the Legend for the number of jobs (job count)
const legendWidth = heatmapWidth;
const legendHeight = 15;
const legendMargin = { top: -70, left: heatmapWidth - 300 };

const defs = svg.append("defs");

// Define a linear gradient 
const linearGradient = defs.append("linearGradient")
  .attr("id", "legend-gradient");

linearGradient.selectAll("stop")
  .data([
    { offset: "0%", color: "#e0f3f3" },
    { offset: "100%", color: "#66c2a5" }
  ])
  .enter()
  .append("stop")
  .attr("offset", d => d.offset)
  .attr("stop-color", d => d.color);

// Create a group for the legend and move it 
const legendGroup = heatmapGroup.append("g")
  .attr("transform", `translate(${legendMargin.left}, ${legendMargin.top})`);

legendGroup.append("rect")
  .attr("width", legendWidth)
  .attr("height", legendHeight)
  .style("fill", "url(#legend-gradient)")
  .style("stroke", "black")
  .style("stroke-width", 0.5);

// Add min/max text labels
const maxCount = d3.max(heatmapData, d => d.count);
legendGroup.append("text")
  .attr("x", 0)
  .attr("y", -5)
  .style("font-size", "10px")
  .text("0");

legendGroup.append("text")
  .attr("x", legendWidth)
  .attr("y", -5)
  .attr("text-anchor", "end")
  .style("font-size", "10px")
  .text(maxCount);

//HIGHLIGHT INTERACTIVITY
let locked = false;
let lockedClass = null;

//Function to highlight the cells
function highlightCells(selector) {
  heatmapGroup.selectAll("rect")
    .style("opacity", d => {
      const className = `year-${d.work_year} size-${d.company_size}`;
      return selector(className) ? 1 : 0.2;
    });
}

function resetHighlight() {
  heatmapGroup.selectAll("rect").style("opacity", 1);
}

// Add summary display when hovering on the cells
d3.select("body").append("div")
  .attr("id", "summary")
  .style("margin-top", "10px")
  .style("font-weight", "bold");

//Attach interaction handlers to all elements (cells) in the heatmap
heatmapGroup.selectAll("rect")
  .on("click", function(event, d) {
    // Determine if the user is holding Ctrl (Windows) or Cmd (Mac) while clicking
    const isCtrl = event.ctrlKey || event.metaKey; // metaKey for Mac users
    // Build a class string based on the clicked data's company size or work year
    const cls = isCtrl ? `size-${d.company_size}` : `year-${d.work_year}`;

    if (locked && lockedClass === cls) {
      // // If the same cell group is already locked, clicking again will unlock
      locked = false;
      lockedClass = null;
      resetHighlight();
      // Clear summary text
      d3.select("#summary").text("");
      return;
    }

    // Otherwise, lock the current selection
    locked = true;
    lockedClass = cls;

    // Highlight only the cells matching the selected class
    highlightCells(cn => cn.includes(cls));

    // Calculate the total number of jobs for the selected year or company size
    const total = d3.sum(heatmapData.filter(dd =>
      cls.includes("year")
        ? dd.work_year === d.work_year
        : dd.company_size === d.company_size
    ), dd => dd.count);

    // Update the summary text with the total jobs for the selected group
    d3.select("#summary").text(`Total Jobs in ${cls.includes("year") ? d.work_year : d.company_size}: ${total}`);
  })
  .on("mouseover", function(event, d) {
    if (locked) return;
    const isCtrl = event.ctrlKey || event.metaKey;
    const cls = isCtrl ? `size-${d.company_size}` : `year-${d.work_year}`;
    // Temporarily highlight matching cells while hovering
    highlightCells(cn => cn.includes(cls));
  })
  .on("mouseout", function() {
    // When the mouse leaves a cell and no selection is locked, remove highlights
    if (!locked) resetHighlight();
  });

});

//References:
//https://observablehq.com/@d3/parallel-coordinates
//https://www.c-sharpcorner.com/article/drawing-a-heatmap-using-d3-js2/
//https://d3-graph-gallery.com/graph/heatmap_basic.html
//https://www.d3indepth.com/axes/
//https://d3js.org/d3-selection/events
//https://www.stator-afm.com/tutorial/d3-js-mouse-events/
//https://d3-graph-gallery.com/graph/interactivity_brush.html
//https://d3js.org/d3-transition/selecting
//https://medium.com/@kj_schmidt/show-data-on-mouse-over-with-d3-js-3bf598ff8fc2



