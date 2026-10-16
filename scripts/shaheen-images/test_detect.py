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

    def test_a_faint_overlay_read_in_pieces_goes_whole(self):
        # Al Qannas: at full size the OCR reads only «instagram»; the zoomed re-read finds the rest in pieces.
        boxes = [box('instagram', 0.99, (550, 822, 613, 840)), box(': joveychic', 0.93, (618, 823, 690, 840)),
                 box('www.joveychic.net', 0.91, (552, 800, 668, 818)), box('AL QANNAS', 0.98, (560, 640, 680, 660)),
                 box('EAU DE PARFUM', 0.97, (560, 590, 690, 605))]
        p = plan(boxes, TOKENS)
        self.assertEqual(sorted(p['marks']), [': joveychic', 'instagram', 'www.joveychic.net'])

    def test_a_shop_name_line_next_to_a_mark_goes_but_the_product_name_stays(self):
        boxes = [box('www.joveychic.net', 0.97, (552, 800, 668, 818)), box('JOVEYCHIC', 0.96, (560, 821, 640, 838)),
                 box('Lattafa', 0.96, (560, 842, 620, 858))]
        self.assertEqual(sorted(plan(boxes, TOKENS)['marks']), ['JOVEYCHIC', 'www.joveychic.net'])

    def test_product_text_on_the_same_line_as_a_mark_stays(self):
        boxes = [box('SOUQSCENT.COM', 0.96, (432, 692, 559, 714)), box('100ml', 0.97, (575, 693, 630, 713))]
        self.assertEqual(plan(boxes, TOKENS)['marks'], ['SOUQSCENT.COM'])


if __name__ == '__main__':
    unittest.main()
