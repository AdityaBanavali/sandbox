import 'package:flutter/material.dart';
import 'package:firebase_database/firebase_database.dart';
import 'dart:math';
import 'package:intl/intl.dart';

class EmergencyDashboard extends StatelessWidget {
  const EmergencyDashboard({super.key});

  // Simulates a new alert for testing
  void _simulateAlert() {
    final databaseRef = FirebaseDatabase.instance.ref("alerts");
    String newKey = databaseRef.push().key!;
    databaseRef.child(newKey).set({
      "status": "active",
      "time": DateTime.now().toIso8601String(),
      "lat": (37.785834 + Random().nextDouble() * 0.01).toStringAsFixed(6),
      "lng": (-122.406417 + Random().nextDouble() * 0.01).toStringAsFixed(6),
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Safety Monitor"),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_alert),
            onPressed: _simulateAlert,
            tooltip: 'Simulate Alert',
          ),
        ],
      ),
      body: StreamBuilder(
        stream: FirebaseDatabase.instance.ref('alerts').orderByChild('time').onValue,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text("Error: ${snapshot.error}"));
          }
          if (!snapshot.hasData || snapshot.data!.snapshot.value == null) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shield, size: 80, color: Colors.grey),
                  SizedBox(height: 20),
                  Text("No alerts detected.", style: TextStyle(fontSize: 18)),
                  SizedBox(height: 10),
                  Text("You can simulate one using the button above.", style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          final data = snapshot.data!.snapshot.value;
          if (data is! Map) {
            return const Center(child: Text("Unexpected data format."));
          }

          Map<dynamic, dynamic> alerts = data;
          List<dynamic> alertList = alerts.entries.map((e) => e.value).toList();
          
          // Sort alerts to show the newest first
          alertList.sort((a, b) => (b['time'] ?? '').compareTo(a['time'] ?? ''));

          return ListView.builder(
            itemCount: alertList.length,
            itemBuilder: (context, index) {
              final alert = alertList[index];
              if (alert is! Map) {
                return const SizedBox.shrink(); // Skip invalid entries
              }
              String time;
              if (alert['time'] != null) {
                try {
                  final dateTime = DateTime.parse(alert['time']);
                  time = DateFormat.yMd().add_jms().format(dateTime);
                } catch (e) {
                  time = 'Invalid date';
                }
              } else {
                time = 'N/A';
              }
              
              final String coords = (alert['lat'] != null && alert['lng'] != null)
                  ? "${alert['lat']}, ${alert['lng']}"
                  : "Location not available";
              
              final String status = alert['status'] ?? 'unknown';

              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
                elevation: 3,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                color: status == 'active' ? Colors.red.shade50 : Colors.green.shade50,
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  leading: Icon(
                    status == 'active' ? Icons.warning_amber_rounded : Icons.check_circle_outline, 
                    color: status == 'active' ? Colors.red.shade700 : Colors.green.shade700, 
                    size: 40
                  ),
                  title: Text(
                    status == 'active' ? "Fall Detected!" : "Alert Cleared", 
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 5),
                      Text("Time: $time", style: TextStyle(color: Colors.grey.shade700)),
                      const SizedBox(height: 3),
                      Text("Location: $coords", style: TextStyle(color: Colors.grey.shade700)),
                    ],
                  ),
                  isThreeLine: true,
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _simulateAlert,
        tooltip: 'Simulate Alert',
        child: const Icon(Icons.add_alert),
      ),
    );
  }
}
