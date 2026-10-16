"""Rules of detect.py on the real cases found in the supplier's photos (python3 scripts/shaheen-images/test_detect.py)."""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
from detect import brand_tokens, classify, mask_boxes, plan

TOKENS = brand_tokens(['Lattafa', 'Lattafa Pride', 'Maison Alhambra', 'Ard Al Zaafaran', 'Afnan', 'Armaf', 'Zimaya', 'Volare'])
box = lambda text, score=0.97, b=(400, 900, 600, 920): {'text': text, 'score': score, 'box': list(b)}


class Rules(unittest.TestCase):
    def test_other_shops_and_the_supplier_are_removed(self):
        for t in ['SOUOSCENT.COM', 'www.joveychic.net', 'www.shamperfume.com', 'SHAM PERFUME', '+60 17-873 6877',
                  '@shamperfumestore', 'instagram : joveychic', 'wa.me/60123456789']:
            self.assertIn(classify(box(t), TOKENS), ('source', 'contact'), t)

    def test_the_makers_print_on_the_box_stays(self):
        for t in ['www.lattafa.com', 'www.lattfa.com', 'www.afnan.com·clc', 'lattafaperfumes', 'www.mahabubperfumes.com',
                  'EAU DE PARFUM', '100ml 3.4 FL.OZ', 'Made in U.A.E', 'Lattafa']:
            self.assertIsNone(classify(box(t), TOKENS), t)

    def test_misreads_and_patterns_are_not_guessed(self):
        self.assertIsNone(classify(box('0000000000', 0.85), TOKENS), 'decorative pattern')
        self.assertIsNone(classify(box('o.com', 0.88), TOKENS), 'too short to be a name')
        self.assertEqual(classify(box('wwtaba.com', 0.67), TOKENS), 'review', 'unclear read: left for a human')

    def test_the_whole_overlay_block_goes(self):
        # «www.joveychic.net» read badly just above «instagram : joveychic».
        boxes = [box('instagram : joveychic', 0.99, (330, 330, 590, 350)), box('wwwiovevchic.nct', 0.6, (335, 300, 575, 320)),
                 box('100ml e 3.4', 0.97, (600, 40, 760, 70)), box('SECOND SONG', 0.95, (330, 200, 560, 215))]
        p = plan(boxes, TOKENS)
        self.assertEqual(sorted(p['marks']), ['instagram : joveychic', 'wwwiovevchic.nct'])
        self.assertEqual(len(mask_boxes(p['remove'], 1080, 1080)), 2)


if __name__ == '__main__':
    unittest.main()
