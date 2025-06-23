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
import {
  ChevronDown,
  ChevronRight,
  Info,
  Server,
  HardDrive,
} from "lucide-react";

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
  const [expandedServer, setExpandedServer] = useState(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthlyHours = daysInMonth * 24;

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

  const calculateHoursFromCreation = (createdDate) => {
    const now = new Date();
    const created = new Date(createdDate);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = created > monthStart ? created : monthStart;

    if (now < start) return 0;

    const diffMs = now - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHours;
  };

  const calculateDaysFromCreation = (createdDate) => {
    const now = new Date();
    const created = new Date(createdDate);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = created > monthStart ? created : monthStart;
    if (now < start) return 0;

    const diffMs = now - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
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

  const calculateServerCost = (
    server,
    instanceType,
    volumeAmountPerIteration,
  ) => {
    const actualHours = calculateHoursFromCreation(server.created_date);
    const actualDays = calculateDaysFromCreation(server.created_date);

    const currentStorageCost =
      parseInt(server.volume) * volumeAmountPerIteration * (actualDays / 30);
    const currentComputeCost =
      server.status === "Running"
        ? instanceType.amount_per_iteration * actualHours
        : 0;

    const monthlyStorageCost =
      parseInt(server.volume) * volumeAmountPerIteration;
    const monthlyComputeCost =
      server.status === "Running"
        ? instanceType.amount_per_iteration * monthlyHours
        : 0;

    return {
      current: {
        storage: currentStorageCost,
        compute: currentComputeCost,
        total: currentStorageCost + currentComputeCost,
        hours: actualHours,
        days: actualDays,
      },
      monthly: {
        storage: monthlyStorageCost,
        compute: monthlyComputeCost,
        total: monthlyStorageCost + monthlyComputeCost,
        hours: monthlyHours,
      },
    };
  };

  const getAllServers = () => {
    const servers = [];

    data.AWS_usable_services.forEach((service) => {
      if (service.service === "Elastic Compute Cloud") {
        service.sub_services.forEach((instanceType) => {
          Object.entries(instanceType.enabled_region).forEach(
            ([region, serverList]) => {
              serverList.forEach((server) => {
                const cost = calculateServerCost(
                  server,
                  instanceType,
                  service.volume_amount_per_iteration,
                );
                servers.push({
                  ...server,
                  instanceType: instanceType.service,
                  region,
                  cost,
                  instancePrice: instanceType.amount_per_iteration,
                  volumePrice: service.volume_amount_per_iteration,
                });
              });
            },
          );
        });
      }
    });

    return servers.sort((a, b) => b.cost.monthly.total - a.cost.monthly.total);
  };

  const calculateVPCCost = () => {
    const vpcService = data.AWS_usable_services.find(
      (s) => s.service === "Virtual Private Cloud",
    );
    if (!vpcService) return 0;

    return vpcService.sub_services.reduce((total, subService) => {
      return (
        total +
        Object.values(subService.enabled_region).reduce((sum, count) => {
          return (
            sum +
            subService.amount_per_iteration *
              subService.iterations_per_month *
              count
          );
        }, 0)
      );
    }, 0);
  };

  const calculateAMICost = () => {
    const amiService = data.AWS_usable_services.find(
      (s) => s.service === "AMI",
    );
    if (!amiService) return 0;

    return Object.values(amiService.sub_services).reduce((total, amis) => {
      return (
        total +
        amis.reduce(
          (sum, ami) =>
            sum +
            parseFloat(ami.used_ebs_size) * amiService.amount_per_iteration,
          0,
        )
      );
    }, 0);
  };

  const allServers = getAllServers();
  const totalServerCost = allServers.reduce(
    (sum, server) => sum + server.cost.monthly.total,
    0,
  );
  const totalCurrentServerCost = allServers.reduce(
    (sum, server) => sum + server.cost.current.total,
    0,
  );
  const vpcCost = calculateVPCCost();
  const amiCost = calculateAMICost();
  const defaultServicesTotal = data.AWS_default_services.reduce(
    (total, service) => total + service.total_amount,
    0,
  );
  const totalMonthlyCost =
    totalServerCost + vpcCost + amiCost + defaultServicesTotal;
  const totalCurrentCost =
    totalCurrentServerCost + vpcCost + amiCost + defaultServicesTotal;

  const servicesChartData = [
    { name: "EC2 Servers", cost: totalServerCost },
    { name: "VPC", cost: vpcCost },
    { name: "AMI", cost: amiCost },
    { name: "Default Services", cost: defaultServicesTotal },
  ];

  const toggleServer = (serverName) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">
            Monthly Cost: ${totalMonthlyCost.toFixed(2)}
          </h2>
          <p className="text-lg text-gray-600">
            Current Cost to Date: ${totalCurrentCost.toFixed(2)}
          </p>
        </div>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Monthly Cost Breakdown</h3>
          <BarChart width={400} height={300} data={servicesChartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            <Bar dataKey="cost" fill="#8884d8" />
          </BarChart>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Service Distribution</h3>
          <PieChart width={400} height={300}>
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Running Servers</div>
          <div className="text-2xl font-bold text-blue-600">
            {allServers.filter((s) => s.status === "Running").length}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Stopped Servers</div>
          <div className="text-2xl font-bold text-red-600">
            {allServers.filter((s) => s.status === "Stopped").length}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Monthly Server Costs</div>
          <div className="text-2xl font-bold text-green-600">
            ${totalServerCost.toFixed(2)}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Current Server Costs</div>
          <div className="text-2xl font-bold text-purple-600">
            ${totalCurrentServerCost.toFixed(2)}
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">
            Other Services Monthly Cost
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            ${(vpcCost + amiCost + defaultServicesTotal).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="space-y-3 relative border-2 border-gray-200 rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">
          EC2 Servers ({allServers.length} total)
        </h3>

        <div className="max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {allServers.map((server, index) => (
              <div
                key={`${server.name}-${index}`}
                className="border rounded-lg overflow-hidden transition-all duration-200"
              >
                <div
                  className={`p-4 cursor-pointer hover:bg-gray-50 flex flex-col gap-2 transition-colors duration-200 ${
                    server.status === "Running"
                      ? "border-l-4 border-l-green-500"
                      : "border-l-4 border-l-red-500"
                  }`}
                  onClick={() => toggleServer(`${server.name}-${index}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedServer === `${server.name}-${index}` ? (
                        <ChevronDown size={16} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-500" />
                      )}
                      <Server
                        size={16}
                        className={
                          server.status === "Running"
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      />
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {server.name}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        server.status === "Running"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {server.status}
                      {server.status === "Running" &&
                        ` for ${server.cost.current.days}d`}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Monthly</div>
                      <div className="font-semibold">
                        ${server.cost.monthly.total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Current</div>
                      <div className="font-semibold text-blue-600">
                        ${server.cost.current.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {expandedServer && (
        <div className="space-y-3 relative bg-white border-2 border-gray-200 rounded-lg shadow-sm p-4 mb-4 mt-4">
          {(() => {
            const server = allServers.find(
              (s, i) => `${s.name}-${i}` === expandedServer,
            );
            if (!server) return null;

            return (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-lg">
                    {server.name} ••• {server.instanceType} ••• {server.region}
                  </h4>
                  <button
                    onClick={() => setExpandedServer(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    X
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-900 flex items-center gap-2">
                      <Server size={16} />
                      Compute Cost
                    </h5>
                    <div className="bg-gray-50 p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Hourly Rate:
                        </span>
                        <span className="font-medium">
                          ${server.instancePrice}/hr
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">
                          Current Up time Hours:
                        </span>
                        <span className="font-medium">
                          {server.cost.current.hours}h
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">
                          Monthly Up time Hours:
                        </span>
                        <span className="font-medium">
                          {server.status === "Running"
                            ? `${monthlyHours}h`
                            : "0h"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <span className="font-medium">Current Total:</span>
                        <span className="font-bold text-blue-600">
                          ${server.cost.current.compute.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Monthly Total:</span>
                        <span className="font-bold text-blue-600">
                          ${server.cost.monthly.compute.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-900 flex items-center gap-2">
                      <HardDrive size={16} />
                      Storage Cost
                    </h5>
                    <div className="bg-gray-50 p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Volume Size:
                        </span>
                        <span className="font-medium">{server.volume} GB</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">
                          Price per GB:
                        </span>
                        <span className="font-medium">
                          ${server.volumePrice}/GB
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">
                          Days Active:
                        </span>
                        <span className="font-medium">
                          {server.cost.current.days}d
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <span className="font-medium">Current Total:</span>
                        <span className="font-bold text-green-600">
                          ${server.cost.current.storage.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Monthly Total:</span>
                        <span className="font-bold text-green-600">
                          ${server.cost.monthly.storage.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {server.status === "Stopped" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-4">
                    <div className="text-xs text-yellow-800">
                      <Info size={12} className="inline mr-1" />
                      Stopped servers only incur storage costs
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold">Other AWS Services</h3>

        {vpcCost > 0 && (
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Virtual Private Cloud</div>
                <div className="text-sm text-gray-500">
                  Network infrastructure
                </div>
              </div>
              <span className="font-semibold">${vpcCost.toFixed(2)}</span>
            </div>
          </div>
        )}

        {(() => {
          const amiService = data.AWS_usable_services.find(
            (s) => s.service === "AMI",
          );
          if (!amiService) return null;

          const amisByRegion = [];
          let totalAmiCost = 0;

          Object.entries(amiService.sub_services).forEach(([region, amis]) => {
            const regionCost = amis.reduce(
              (sum, ami) =>
                sum +
                parseFloat(ami.used_ebs_size) * amiService.amount_per_iteration,
              0,
            );
            totalAmiCost += regionCost;
            amisByRegion.push({ region, amis, cost: regionCost });
          });

          return (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="font-medium">AMI (Amazon Machine Images)</div>
                  <div className="text-sm text-gray-500">{amiService.desc}</div>
                </div>
                <span className="font-semibold">
                  ${totalAmiCost.toFixed(2)}
                </span>
              </div>
              <div className="space-y-3">
                {amisByRegion.map(({ region, amis, cost }) => (
                  <div key={region} className="bg-gray-50 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{region}</span>
                      <span className="text-sm font-semibold">
                        ${cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {amis.map((ami, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="text-gray-600">{ami.name}</span>
                          <span className="text-gray-500">
                            {ami.used_ebs_size} GB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="border rounded-lg">
          <div className="p-4">
            <h4 className="font-medium mb-3">Default Services</h4>
            <div className="space-y-2">
              {data.AWS_default_services.map((service, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center">
                    <span className="font-medium">{service.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({service.desc})
                    </span>
                  </div>
                  <span className="font-semibold">
                    ${service.total_amount.toFixed(2)}
                  </span>
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
