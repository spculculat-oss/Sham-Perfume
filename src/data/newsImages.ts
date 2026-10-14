// High-resolution perfume news editorial images
import nicheImg from '../assets/images/niche_perfume_reveal_1791968798991.jpg';
import expoImg from '../assets/images/fragrance_summit_expo_1791968814926.jpg';
import botanicalImg from '../assets/images/botanical_harvest_raw_1791968832488.jpg';
import trendsImg from '../assets/images/perfume_news_global_trends_1791696027070.jpg';
import harvestRoseImg from '../assets/images/grasse_rose_harvest_1791696039244.jpg';
import luxuryExhibitionImg from '../assets/images/luxury_perfume_exhibition_1791696134494.jpg';
import labCompoundingImg from '../assets/images/perfume_lab_compounding_1791692420116.jpg';
import ingredientsPyramidImg from '../assets/images/perfume_ingredients_pyramid_1791692429360.jpg';

export const NEWS_EDITORIAL_IMAGES = {
  nicheLaunch: nicheImg,
  exhibitionSummit: expoImg,
  botanicalHarvest: botanicalImg,
  globalTrends: trendsImg,
  roseHarvest: harvestRoseImg,
  luxuryExhibition: luxuryExhibitionImg,
  labChemistry: labCompoundingImg,
  ingredientsPyramid: ingredientsPyramidImg,
};

export const NEWS_IMAGE_LIST = [
  nicheImg,
  expoImg,
  botanicalImg,
  trendsImg,
  harvestRoseImg,
  luxuryExhibitionImg,
  labCompoundingImg,
  ingredientsPyramidImg,
];

export function getEditorialImageForCategory(category?: string, index: number = 0): string {
  switch (category) {
    case 'niche':
      return [nicheImg, labCompoundingImg, ingredientsPyramidImg][index % 3];
    case 'exhibitions':
      return [expoImg, luxuryExhibitionImg][index % 2];
    case 'harvests':
      return [botanicalImg, harvestRoseImg][index % 2];
    case 'trends':
      return [trendsImg, nicheImg][index % 2];
    case 'ifra':
      return [labCompoundingImg, ingredientsPyramidImg][index % 2];
    default:
      return NEWS_IMAGE_LIST[index % NEWS_IMAGE_LIST.length];
  }
}
