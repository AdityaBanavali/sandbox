import 'package:flutter/material.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:fl_chart/fl_chart.dart';

class AnalysisPage extends StatelessWidget {
  const AnalysisPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Health Analytics")),
      body: StreamBuilder(
        stream: FirebaseDatabase.instance.ref('users/my_user/logs').onValue,
        builder: (context, snapshot) {
          if (!snapshot.hasData || snapshot.data!.snapshot.value == null) {
            return const Center(child: Text("Log symptoms to see insights!"));
          }

          Map logs = snapshot.data!.snapshot.value as Map;
          Map<String, int> counts = {"Cramps": 0, "Headache": 0, "Mood Swing": 0};
          
          // Using a 'for-in' loop to fix the linting warning
          for (var log in logs.values) {
            if (counts.containsKey(log['symptom'])) {
              counts[log['symptom']] = counts[log['symptom']]! + 1;
            }
          }

          final entries = counts.entries.toList();

          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const Text("Symptom Frequency", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 40),
                Expanded(
                  child: BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.spaceAround,
                      barGroups: entries.asMap().entries.map((e) {
                        return BarChartGroupData(
                          x: e.key,
                          barRods: [BarChartRodData(toY: e.value.value.toDouble(), color: Colors.pinkAccent, width: 20)],
                        );
                      }).toList(),
                      titlesData: FlTitlesData(
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) => Text(entries[value.toInt()].key),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}