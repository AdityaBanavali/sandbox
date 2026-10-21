import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:firebase_database/firebase_database.dart';

class MenstrualCyclePage extends StatefulWidget {
  const MenstrualCyclePage({super.key});

  @override
  State<MenstrualCyclePage> createState() => _MenstrualCyclePageState();
}

class _MenstrualCyclePageState extends State<MenstrualCyclePage> {
  CalendarFormat _calendarFormat = CalendarFormat.month;
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  // Reference to your Firebase path
  final DatabaseReference _logsRef = FirebaseDatabase.instance.ref('users/my_user/logs');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Cycle Tracker")),
      body: Column(
        children: [
          TableCalendar(
            firstDay: DateTime.utc(2025, 1, 1),
            lastDay: DateTime.utc(2030, 12, 31),
            focusedDay: _focusedDay,
            calendarFormat: _calendarFormat,
            selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
            onDaySelected: (selectedDay, focusedDay) {
              setState(() {
                _selectedDay = selectedDay;
                _focusedDay = focusedDay;
              });
            },
            onFormatChanged: (format) => setState(() => _calendarFormat = format),
          ),
          Expanded(
            child: StreamBuilder(
              stream: _logsRef.onValue,
              builder: (context, AsyncSnapshot<DatabaseEvent> snapshot) {
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                // Add logic here to display logs from snapshot.data.snapshot.value
                return const Center(child: Text("Logs will appear here"));
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showSymptomDialog(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showSymptomDialog(BuildContext context) {
    // Implement your dialog logic to push data to Firebase
    _logsRef.push().set({
      'date': _selectedDay?.toIso8601String(),
      'symptom': 'Example Symptom',
    });
  }
}