import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LiveChartProps = { title: string; data: any[]; dataKey: string; color: string; empty: boolean };

export default function LiveChart({ title, data, dataKey, color, empty }: LiveChartProps) {
  return <div className="chart-card"><h3>{title}</h3>{empty ? <p className="muted chart-empty">No live records available for this chart.</p> : <ResponsiveContainer width="100%" height={230}>{dataKey === "revenue" ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e4eaf3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(value) => [`JMD $${Number(value ?? 0).toLocaleString("en-JM")}`, "Revenue"]} /><Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} /></BarChart> : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e4eaf3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 3 }} /></LineChart>}</ResponsiveContainer>}</div>;
}
