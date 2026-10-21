
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

exports.onFallDetected = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const alert = snap.data();
    if (alert.alert_type !== "fall") {
      return;
    }

    const userId = alert.user_id;
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const user = userDoc.data();

    if (!user) {
      console.log(`User ${userId} not found.`);
      return;
    }

    const emergencyContact = user.emergency_contacts?.[0];
    if (!emergencyContact?.phone_number) {
        console.log(`Emergency contact for user ${userId} not found.`);
        return;
    }

    const payload = {
      notification: {
        title: "Fall Detected!",
        body: `${user.profile.name} may have fallen. Please check on them.`,
      },
    };

    // This is a placeholder for sending an SMS or push notification.
    // You would use a service like Twilio for SMS or FCM for push notifications.
    console.log(`Sending notification to ${emergencyContact.phone_number}`);
    console.log(`Payload: ${JSON.stringify(payload)}`);

    // Example of sending an FCM notification
    if (user.device_token) {
        try {
            await admin.messaging().sendToDevice(user.device_token, payload);
            console.log("Successfully sent FCM message.");
        } catch (error) {
            console.error("Error sending FCM message:", error);
        }
    }
  });
