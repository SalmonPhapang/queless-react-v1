/**
 * Port of lib/utils/delivery_fee_helper.dart.
 *
 * Fees are tiered by road distance; `-1` means the store is out of range
 * (over 20km) and delivery is unavailable.
 */
const DELIVERY_FEE_0_TO_1_KM = 15.0;
const DELIVERY_FEE_1_TO_3_KM = 23.0;
const DELIVERY_FEE_3_TO_5_KM = 30.0;
const DELIVERY_FEE_5_TO_8_KM = 45.0;
const DELIVERY_FEE_8_TO_10_KM = 60.0;
const DELIVERY_FEE_10_TO_14_KM = 80.0;
const DELIVERY_FEE_14_TO_20_KM = 100.0;

export const DELIVERY_UNAVAILABLE = -1.0;

export const deliveryFeeHelper = {
  calculateFee(distanceMeters: number): number {
    const distanceKm = distanceMeters / 1000.0;

    if (distanceKm < 1.0) return DELIVERY_FEE_0_TO_1_KM;
    if (distanceKm <= 3.0) return DELIVERY_FEE_1_TO_3_KM;
    if (distanceKm <= 5.0) return DELIVERY_FEE_3_TO_5_KM;
    if (distanceKm <= 8.0) return DELIVERY_FEE_5_TO_8_KM;
    if (distanceKm <= 10.0) return DELIVERY_FEE_8_TO_10_KM;
    if (distanceKm <= 14.0) return DELIVERY_FEE_10_TO_14_KM;
    if (distanceKm <= 20.0) return DELIVERY_FEE_14_TO_20_KM;

    return DELIVERY_UNAVAILABLE;
  },
};
