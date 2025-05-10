export const COLORS = {
    ROAD_GRAY: 0x4B4B4B,
    LINE_YELLOW: 0xFFFF00,
    LINE_WHITE: 0xFFFFFF,
    ZONE_LANE: 0x0000FF, // Blue
    ZONE_CORNER: 0x00FF00, // Green
    ZONE_HOVER: 0xFFFFAA, // Light Yellow
    CAR_DEFAULT: 0xFF0000, // Red
    CAR_COLORS: [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xffa500, 0x800080], // Red, Blue, Green, Yellow, Orange, Purple
    POLE_GRAY: 0x808080,
    SIGN_RED: 0xDC143C, // Crimson
    LIGHT_HOUSING: 0x333333,
    LIGHT_RED_ON: 0xFF0000,
    LIGHT_YELLOW_ON: 0xFFFF00,
    LIGHT_GREEN_ON: 0x00FF00,
    LIGHT_OFF: 0x444444,
};

export const SIZES = {
    ROAD_WIDTH: 8, // Total width of road (e.g., 4 lanes wide)
    LANE_WIDTH: 2, // Width of a single lane
    ROAD_LENGTH: 20, // Length of the road arms extending from the center
    LINE_THICKNESS: 0.1,

    CAR_WIDTH: 1.5,
    CAR_HEIGHT: 1,
    CAR_LENGTH: 3,

    SIGN_HEIGHT: 3,
    SIGN_SIZE: 0.7, // Radius of the octagon face

    TRAFFIC_LIGHT_HEIGHT: 4.5,
    TRAFFIC_LIGHT_CYCLE: 10, // Total seconds for one Red-Yellow-Green cycle
};

export const SPEEDS = {
    CAR_NORMAL: 5.0, // Units per second
    STOP_SIGN_DURATION: 1.5, // Seconds to pause at stop sign
};