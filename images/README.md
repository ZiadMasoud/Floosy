# Custom Logo Instructions

## How to Add Your Custom Logo

1. **Place your logo image in this folder**
   - Supported formats: PNG, JPG, SVG, WebP
   - Recommended size: 40x40 pixels (or similar square aspect ratio)
   - Recommended file name: `logo.png`

2. **Update the configuration in `js/app.js`**
   - Open `js/app.js`
   - Find the LOGO CONFIGURATION section at the top of the file (lines 4-16)
   - Set `USE_CUSTOM_LOGO = true` to use your custom image
   - Update `CUSTOM_LOGO_PATH` if your file has a different name or location

   Example:
   ```javascript
   const USE_CUSTOM_LOGO = true;
   const CUSTOM_LOGO_PATH = 'images/my-custom-logo.png';
   ```

3. **To switch back to the default icon**
   - Set `USE_CUSTOM_LOGO = false` in the configuration
   - You can also change the default icon by updating `DEFAULT_LOGO_ICON`

   Example:
   ```javascript
   const USE_CUSTOM_LOGO = false;
   const DEFAULT_LOGO_ICON = 'fas fa-wallet'; // or any Font Awesome icon
   ```

## Logo Design Tips

- Use a transparent background (PNG) for best results
- Keep the design simple and recognizable at small sizes
- Ensure good contrast with the sidebar background
- Test both light and dark themes if applicable

## Troubleshooting

- If your logo doesn't appear, check the browser console for 404 errors
- Make sure the file path in `CUSTOM_LOGO_PATH` is correct relative to `index.html`
- Clear your browser cache after updating the logo file
