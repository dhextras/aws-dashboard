import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [expandedServices, setExpandedServices] = useState({});

  useEffect(() => {
    fetch("/data/charges.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("No charges.json found");
        }
        return response.json();
      })
      .then((jsonData) => {
        setData(jsonData);
      })
      .catch(() => {
        console.log("No charges.json found, please upload a file");
      });
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const newData = JSON.parse(e.target.result);
          setData(newData);
        } catch (error) {
          alert("Invalid JSON file format");
        }
      };
      reader.readAsText(file);
    }
  };

  if (!data)
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">AWS Cost Dashboard</h2>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="text-sm"
          />
        </div>
        <div className="text-center py-8">
          Please upload your charges.json file
        </div>
      </div>
    );

  const calculateSubServiceCost = (subService) => {
    return Object.entries(subService.enabled_region).reduce(
      (total, [_, count]) => {
        return (
          total +
          subService.amount_per_iteration *
            subService.iterations_per_month *
            count
        );
      },
      0,
    );
  };

  const calculateServiceCost = (service) => {
    return service.sub_services.reduce((total, subService) => {
      return total + calculateSubServiceCost(subService);
    }, 0);
  };

  const usableServicesTotal = data.AWS_usable_services.reduce(
    (total, service) => {
      return total + calculateServiceCost(service);
    },
    0,
  );

  const defaultServicesTotal = data.AWS_default_services.reduce(
    (total, service) => {
      return total + service.total_amount;
    },
    0,
  );

  const totalCost = usableServicesTotal + defaultServicesTotal;

  const servicesChartData = [
    ...data.AWS_usable_services.map((service) => ({
      name: service.service,
      cost: calculateServiceCost(service),
    })),
    {
      name: "Default Services",
      cost: defaultServicesTotal,
    },
  ];

  const toggleService = (index) => {
    setExpandedServices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          Total Estimated Monthly Cost: ${totalCost.toFixed(2)}
        </h2>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <BarChart width={500} height={400} data={servicesChartData}>
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={150} />
            <YAxis />
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            <Bar dataKey="cost" fill="#8884d8" />
          </BarChart>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <PieChart width={500} height={400}>
            <Pie
              data={servicesChartData}
              dataKey="cost"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {servicesChartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
          </PieChart>
        </div>
      </div>

      <div className="space-y-4">
        {data.AWS_usable_services.map((service, serviceIndex) => (
          <div key={serviceIndex} className="border rounded-lg">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
              onClick={() => toggleService(serviceIndex)}
            >
              <div className="flex items-center gap-2">
                {expandedServices[serviceIndex] ? (
                  <ChevronDown size={20} />
                ) : (
                  <ChevronRight size={20} />
                )}
                <span className="font-medium">
                  {service.service}
                  <span className="text-xs text-gray-500 font-medium ml-4">
                    ( {service.desc} )
                  </span>
                </span>
              </div>
              <span className="font-medium">
                ${calculateServiceCost(service).toFixed(2)}
              </span>
            </div>
            {expandedServices[serviceIndex] && (
              <div className="p-4 border-t">
                <div className="space-y-3">
                  {service.sub_services.map((subService, subIndex) => (
                    <div
                      key={subIndex}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <div className="font-medium">{subService.service}</div>
                        <div className="text-sm text-gray-500">
                          {Object.entries(subService.enabled_region)
                            .map(
                              ([region, count]) =>
                                `${region}: ${count} ${subService.service_type}${count > 1 ? "s" : ""}`,
                            )
                            .join(" | ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>
                          ${calculateSubServiceCost(subService).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${subService.amount_per_iteration} ×{" "}
                          {subService.iterations_per_month}{" "}
                          {subService.iteration_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="border rounded-lg">
          <div className="p-4">
            <h3 className="font-bold mb-2">Default Services</h3>
            <div className="space-y-2">
              {data.AWS_default_services.map((service, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center">
                    {service.name}
                    <span className="text-xs text-gray-500 font-medium ml-4">
                      {" "}
                      ( {service.desc} )
                    </span>
                  </div>
                  <span>${service.total_amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
