/** @param {string} a @param {string} b */
export function contrast(a: string, b: string) {
    /** @param {string} hex */
    const luminance = (hex: string) => {
        const rgb = [1, 3, 5]
            .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** @param {string} preferred @param {string} background */
export function foregroundForSurface(preferred: string, background: string) {
    if (contrast(preferred, background) >= 4.5)
        return preferred;
    return contrast("#000000", background) >= contrast("#ffffff", background) ? "#000000" : "#ffffff";
}
