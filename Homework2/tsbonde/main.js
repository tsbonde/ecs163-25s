const margin = { top: 40, right: 80, bottom: 70, left: -60 },
      width = 1170 - margin.left - margin.right,
      height = window.innerHeight - margin.top - margin.bottom;
//Declare all the margin information & height & width

//Set up the main svg container where our visualization will be stored
const svg = d3.select("body")
  .append("svg")
  .attr("width", width + margin.left + margin.right + 400)
  .attr("height", height + margin.top + margin.bottom) // <-- stretched
  .style("position", "absolute")
  .style("left", "-50px")
  .style("top", `${margin.top}px`)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

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
  
  // Color scale for "experience_level" (lines)
  const colorScale = d3.scaleOrdinal()
    .domain([...new Set(data.map(d => d.experience_level))])
    .range(d3.schemeSet2);

  // Color scale for "employment_type" (bars)
  const employmentTypes = [...new Set(data.map(d => d.employment_type))];
  const colorScaleEmployment = d3.scaleOrdinal()
    .domain(employmentTypes)
    .range(d3.schemeSet2);

  // Set up scales for each dimension
  dimensions.forEach(dim => {
    if (["salary_in_usd", "remote_ratio"].includes(dim)) {
      y[dim] = d3.scaleLinear()
        .domain(d3.extent(data, d => +d[dim]))
        .range([height, 0]);
    } else {
      const domain = [...new Set(data.map(d => d[dim]))];
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


  // BAR CHART
  const barMargin = { top: 40, right: 40, bottom: 60, left: 60 };
  const barWidth = 300;
  const barHeight = 300;

  // Group data by employment_type and calculate average salary
  const salaryByEmployment = Array.from(
    d3.group(data, d => d.employment_type),
    ([key, values]) => ({
      employment_type: key,
      avg_salary: d3.mean(values, d => +d.salary_in_usd)
    })
  );

  const barX = d3.scaleBand()
    .domain(salaryByEmployment.map(d => d.employment_type))
    .range([0, barWidth])
    .padding(0.2);

  const barY = d3.scaleLinear()
    .domain([0, d3.max(salaryByEmployment, d => d.avg_salary)])
    .nice()
    .range([barHeight, 0]);
  //Make a bar chart group to hold the position
  const barChartGroup = svg.append("g")
    .attr("transform", `translate(${width + 30}, ${margin.top - 40})`); //controls left/right alignment & up or down

  // X Axis
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
const heatmapX = d3.scaleBand()
  .domain(workYears)
  .range([0, heatmapWidth])
  .padding(0.05);

const heatmapY = d3.scaleBand()
  .domain(companySizes)
  .range([0, heatmapHeight])
  .padding(0.05);
  
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
  .append("title")
  .text(d => `${d.work_year} | ${d.company_size}: ${d.count}`);

// Axes
heatmapGroup.append("g")
  .attr("transform", `translate(0,${heatmapHeight})`)
  .call(d3.axisBottom(heatmapX));

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

//Define a linear gradient 
const linearGradient = defs.append("linearGradient")
  .attr("id", "legend-gradient");

  //Get the colors for the scales from low to high
linearGradient.selectAll("stop")
  .data([
    { offset: "0%", color: "#e0f3f3" },
    { offset: "100%", color: "#66c2a5" }
  ])
  .enter()
  .append("stop")
  .attr("offset", d => d.offset)
  .attr("stop-color", d => d.color);

//Create a group for the legend and be able to move it 
const legendGroup = heatmapGroup.append("g")
  .attr("transform", `translate(${legendMargin.left}, ${legendMargin.top})`);

//Actually draw the rectangle mentioned and add in the border for visibility
legendGroup.append("rect")
  .attr("width", legendWidth)
  .attr("height", legendHeight)
  .style("fill", "url(#legend-gradient)")
  .style("stroke", "black")
  .style("stroke-width", 0.5);

//Add text labels for min and max values in the count field 
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

});

//References:
//https://observablehq.com/@d3/parallel-coordinates
//https://www.c-sharpcorner.com/article/drawing-a-heatmap-using-d3-js2/
//https://d3-graph-gallery.com/graph/heatmap_basic.html
//https://www.d3indepth.com/axes/




