const Notification = require("../models/Notification");

class NotificationService {
  /**
   * Notification types
   */
  static TYPES = {
    BOOKING_REQUEST: "booking_request",
    BOOKING_ACCEPTED: "booking_accepted",
    BOOKING_REJECTED: "booking_rejected",
    BOOKING_CANCELLED: "booking_cancelled",
    RIDE_CANCELLED: "ride_cancelled",
  };

  /**
   * Send booking request notification to driver
   */
  static async notifyBookingRequest(driverId, bookingData) {
    return await Notification.create({
      user_id: driverId,
      type: this.TYPES.BOOKING_REQUEST,
      payload: {
        booking_id: bookingData.id,
        ride_id: bookingData.ride_id,
        passenger_name: `${bookingData.passenger_first_name} ${bookingData.passenger_last_name}`,
        seats: bookingData.seats,
      },
    });
  }

  /**
   * Send booking accepted notification to passenger
   */
  static async notifyBookingAccepted(passengerId, bookingData) {
    return await Notification.create({
      user_id: passengerId,
      type: this.TYPES.BOOKING_ACCEPTED,
      payload: {
        booking_id: bookingData.id,
        ride_id: bookingData.ride_id,
        driver_name: `${bookingData.driver_first_name} ${bookingData.driver_last_name}`,
      },
    });
  }

  /**
   * Send booking rejected notification to passenger
   */
  static async notifyBookingRejected(passengerId, bookingData) {
    return await Notification.create({
      user_id: passengerId,
      type: this.TYPES.BOOKING_REJECTED,
      payload: {
        booking_id: bookingData.id,
        ride_id: bookingData.ride_id,
      },
    });
  }

  /**
   * Send booking cancelled notification
   */
  static async notifyBookingCancelled(
    userId,
    bookingData,
    isCancelledByPassenger
  ) {
    return await Notification.create({
      user_id: userId,
      type: this.TYPES.BOOKING_CANCELLED,
      payload: {
        booking_id: bookingData.id,
        ride_id: bookingData.ride_id,
        cancelled_by: isCancelledByPassenger ? "passenger" : "driver",
      },
    });
  }

  /**
   * Send ride cancelled notification to all passengers
   */
  static async notifyRideCancelled(passengerId, rideData) {
    return await Notification.create({
      user_id: passengerId,
      type: this.TYPES.RIDE_CANCELLED,
      payload: {
        ride_id: rideData.id,
        airport_name: rideData.airport_name,
        datetime_start: rideData.datetime_start,
      },
    });
  }
}

module.exports = NotificationService;
