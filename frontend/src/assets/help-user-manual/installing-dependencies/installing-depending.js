// Image index for installing-dependencies help topic
// Import each image and export both named exports and a default array
import img1 from './1.png';
import img2 from './2.png';
import img3 from './3.png';
import img4 from './4.png';
import img5 from './5.png';
import img6 from './6.png';
import img7 from './7.png';

// Named exports for direct import
export { img1, img2, img3, img4, img5, img6, img7 };

// Default export: ordered array (useful for numeric indexing)
const images = [img1, img2, img3, img4, img5, img6, img7];
export default images;

// Optional mapping by filename (useful if callers want an object)
export const imagesMap = {
	'1.png': img1,
	'2.png': img2,
	'3.png': img3,
	'4.png': img4,
	'5.png': img5,
	'6.png': img6,
	'7.png': img7,
};

