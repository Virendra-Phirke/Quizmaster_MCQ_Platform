"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "../lightswind/chart";
import { LegacyTestResult } from "../../contexts/TestContext";

const chartConfig = {
    students: {
        label: "Students",
        color: "#6366f1", // Indigo-500
    },
} satisfies ChartConfig;

interface TestDetailChartProps {
    results: LegacyTestResult[];
    totalMarks?: number;
}

export function TestDetailChart({ results }: TestDetailChartProps) {
    const chartData = useMemo(() => {
        // Initialize buckets
        const buckets = [
            { range: "0-20%", count: 0, fill: "#ef4444" }, // Red-500
            { range: "21-40%", count: 0, fill: "#f97316" }, // Orange-500
            { range: "41-60%", count: 0, fill: "#eab308" }, // Yellow-500
            { range: "61-80%", count: 0, fill: "#3b82f6" }, // Blue-500
            { range: "81-100%", count: 0, fill: "#22c55e" }, // Green-500
        ];

        results.forEach((result) => {
            // Calculate percentage score
            let percentage = result.score;
            if (result.earnedMarks != null && result.totalMarks != null && result.totalMarks > 0) {
                percentage = (result.earnedMarks / result.totalMarks) * 100;
            }

            if (percentage <= 20) buckets[0].count++;
            else if (percentage <= 40) buckets[1].count++;
            else if (percentage <= 60) buckets[2].count++;
            else if (percentage <= 80) buckets[3].count++;
            else buckets[4].count++;
        });

        return buckets;
    }, [results]);

    if (results.length === 0) return null;

    return (
        <div className="bg-slate-900 border border-slate-800/50 rounded-2xl shadow-xl p-4 sm:p-6 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

            <div className="relative mb-6">
                <h3 className="text-lg font-semibold text-slate-100">Score Distribution</h3>
                <p className="text-sm text-slate-400">Student performance overview</p>
            </div>

            <div className="h-[300px] w-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 0, bottom: 20, left: -20 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis
                            dataKey="range"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            allowDecimals={false}
                        />
                        <ChartTooltip
                            cursor={{ fill: "#334155", opacity: 0.2 }}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="count"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                            name="Students"
                        />
                    </BarChart>
                </ChartContainer>
            </div>
        </div>
    );
}
