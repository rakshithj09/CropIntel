// Disease information and treatment recommendations

export interface DiseaseInfo {
  name: string
  description: string
  symptoms: string[]
  treatment: string[]
  prevention: string[]
  severity: 'low' | 'medium' | 'high'
  affectedCrops: string[]
}

export const DISEASE_INFO: Record<string, DiseaseInfo> = {
  // Corn Diseases
  'Blight': {
    name: 'Corn Blight',
    description: 'A fungal disease that causes leaf spots and can reduce yield significantly.',
    symptoms: ['Brown or tan spots on leaves', 'Lesions with yellow halos', 'Premature leaf death'],
    treatment: [
      'Apply fungicides containing azoxystrobin or propiconazole',
      'Remove and destroy infected plant debris',
      'Rotate crops to break disease cycle'
    ],
    prevention: [
      'Plant resistant varieties',
      'Ensure proper spacing for air circulation',
      'Avoid overhead irrigation',
      'Practice crop rotation'
    ],
    severity: 'high',
    affectedCrops: ['corn']
  },
  'Common Rust': {
    name: 'Common Rust',
    description: 'A fungal disease characterized by reddish-brown pustules on leaves.',
    symptoms: ['Reddish-brown pustules on upper leaf surface', 'Yellowing around pustules', 'Premature leaf drop'],
    treatment: [
      'Apply fungicides early in the season',
      'Use resistant hybrid varieties',
      'Remove infected plant material'
    ],
    prevention: [
      'Plant rust-resistant varieties',
      'Avoid late planting',
      'Maintain proper plant nutrition'
    ],
    severity: 'medium',
    affectedCrops: ['corn']
  },
  'Gray Leaf Spot': {
    name: 'Gray Leaf Spot',
    description: 'A fungal disease that causes rectangular gray lesions on leaves.',
    symptoms: ['Rectangular gray lesions', 'Lesions with defined edges', 'Leaf blighting'],
    treatment: [
      'Apply fungicides with active ingredients like pyraclostrobin',
      'Remove crop residue after harvest',
      'Use tillage to bury infected residue'
    ],
    prevention: [
      'Plant resistant hybrids',
      'Practice crop rotation',
      'Avoid continuous corn planting'
    ],
    severity: 'high',
    affectedCrops: ['corn']
  },
  
  // Rice Diseases
  'Rice Blast': {
    name: 'Rice Blast',
    description: 'One of the most destructive rice diseases, caused by the fungus Magnaporthe oryzae.',
    symptoms: ['Diamond-shaped lesions on leaves', 'Node and neck rot', 'White to gray centers with brown borders'],
    treatment: [
      'Apply fungicides like tricyclazole or azoxystrobin',
      'Use resistant varieties',
      'Proper water management'
    ],
    prevention: [
      'Plant blast-resistant varieties',
      'Avoid excessive nitrogen fertilization',
      'Maintain proper water levels',
      'Remove infected plant debris'
    ],
    severity: 'high',
    affectedCrops: ['rice']
  },
  'Bacterial Leaf Blight': {
    name: 'Bacterial Leaf Blight',
    description: 'A bacterial disease that causes water-soaked lesions and leaf blight.',
    symptoms: ['Water-soaked lesions', 'Yellowing along leaf margins', 'Wilting and death of leaves'],
    treatment: [
      'Apply copper-based bactericides',
      'Use resistant varieties',
      'Proper field sanitation'
    ],
    prevention: [
      'Use disease-free seeds',
      'Avoid overhead irrigation',
      'Practice crop rotation',
      'Remove infected plants'
    ],
    severity: 'high',
    affectedCrops: ['rice']
  },
  'Brown Spot': {
    name: 'Brown Spot',
    description: 'A fungal disease causing brown spots on leaves and grains.',
    symptoms: ['Small brown spots on leaves', 'Spots enlarge and coalesce', 'Grain discoloration'],
    treatment: [
      'Apply fungicides containing propiconazole',
      'Improve soil fertility',
      'Use resistant varieties'
    ],
    prevention: [
      'Maintain proper soil nutrition',
      'Use certified seeds',
      'Practice good field hygiene'
    ],
    severity: 'medium',
    affectedCrops: ['rice']
  },
  // The rice model reports Blast and Brown Spot as one class: their lesions are
  // visually inseparable on field photos, so we give combined guidance rather
  // than guess between two near-identical fungal diseases.
  'Blast or Brown Spot': {
    name: 'Rice Blast or Brown Spot',
    description:
      'Two common fungal leaf diseases of rice (Magnaporthe oryzae blast and Bipolaris oryzae brown spot) that produce visually similar lesions and are hard to tell apart from a leaf photo alone. Treatment overlaps, so manage for both.',
    symptoms: [
      'Brown lesions on leaves — diamond/spindle-shaped (blast) or small round-to-oval (brown spot)',
      'Lesions with gray or tan centers and darker brown borders',
      'Spots enlarge and coalesce; severe cases cause leaf drying and grain discoloration'
    ],
    treatment: [
      'Apply a broad-spectrum fungicide effective on both — e.g. azoxystrobin, or tricyclazole (blast) plus propiconazole (brown spot)',
      'Improve soil fertility and correct potassium/silicon deficiency (reduces brown spot)',
      'Use resistant varieties and proper water management',
      'For an exact diagnosis, have a leaf sample confirmed by an extension lab'
    ],
    prevention: [
      'Plant resistant varieties and use certified, disease-free seed',
      'Avoid excessive nitrogen and maintain balanced soil nutrition',
      'Maintain proper water levels and field hygiene',
      'Remove and destroy infected plant debris'
    ],
    severity: 'high',
    affectedCrops: ['rice']
  },

  // Soybean Diseases (classes from the vaishaligbhujade single-source dataset)
  'Rust': {
    name: 'Soybean Rust',
    description:
      'An aggressive fungal disease (Phakopsora pachyrhizi) producing small tan-to-brown pustules, mostly on the underside of leaves; can defoliate fields rapidly.',
    symptoms: [
      'Small tan to reddish-brown pustules, mainly on lower leaf surface',
      'Yellowing that starts in the lower canopy',
      'Rapid premature defoliation in severe cases'
    ],
    treatment: [
      'Apply triazole or strobilurin fungicides at first detection',
      'Repeat applications per label if conditions stay humid',
      'Monitor nearby fields — rust spreads by wind-borne spores'
    ],
    prevention: [
      'Scout regularly from flowering onward',
      'Plant earlier-maturing varieties in high-risk regions',
      'Follow regional rust alerts'
    ],
    severity: 'high',
    affectedCrops: ['soybean']
  },
  'Frogeye Leaf Spot': {
    name: 'Frogeye Leaf Spot',
    description:
      'A fungal disease (Cercospora sojina) causing circular spots with gray centers and dark reddish-brown borders on soybean leaves.',
    symptoms: [
      'Circular to angular spots with light gray centers',
      'Dark purple-to-brown borders around each spot',
      'Spots merge and leaves drop in severe infections'
    ],
    treatment: [
      'Apply strobilurin or triazole fungicides at early pod stages',
      'Note: strobilurin-resistant strains exist — rotate modes of action',
      'Remove or bury infected residue after harvest'
    ],
    prevention: [
      'Plant resistant varieties',
      'Rotate away from soybean for at least one season',
      'Avoid planting into infested residue'
    ],
    severity: 'medium',
    affectedCrops: ['soybean']
  },
  'Bacterial Pustule': {
    name: 'Bacterial Pustule',
    description:
      'A bacterial disease (Xanthomonas axonopodis pv. glycines) causing small raised pustules surrounded by yellow halos, favored by warm wet weather.',
    symptoms: [
      'Small pale-green spots that develop raised pustules',
      'Yellow halos around lesions',
      'Lesions merge into large dead patches that tear in wind'
    ],
    treatment: [
      'Copper-based bactericides can slow spread (limited efficacy)',
      'Avoid field work while foliage is wet',
      'Remove infected debris after harvest'
    ],
    prevention: [
      'Plant resistant varieties',
      'Use disease-free seed',
      'Rotate with non-host crops'
    ],
    severity: 'medium',
    affectedCrops: ['soybean']
  },
  'Target Leaf Spot': {
    name: 'Target Leaf Spot',
    description:
      'A fungal disease (Corynespora cassiicola) producing brown circular lesions with concentric rings resembling a target.',
    symptoms: [
      'Round reddish-brown spots with lighter centers',
      'Concentric ring (target-like) pattern in larger lesions',
      'Lower-canopy leaves affected first'
    ],
    treatment: [
      'Apply foliar fungicides when lesions appear during pod fill',
      'Improve canopy airflow where practical',
      'Bury infected residue with tillage in problem fields'
    ],
    prevention: [
      'Rotate crops — the fungus survives on residue',
      'Plant tolerant varieties where available',
      'Avoid prolonged leaf wetness (irrigation timing)'
    ],
    severity: 'medium',
    affectedCrops: ['soybean']
  },
  'Sudden Death Syndrome': {
    name: 'Sudden Death Syndrome',
    description:
      'A soil-borne fungal disease (Fusarium virguliforme) that causes interveinal chlorosis, necrosis, and early defoliation; often worse in compacted or wet soils.',
    symptoms: [
      'Yellowing between leaf veins',
      'Brown necrotic patches on leaves',
      'Premature leaf drop',
      'Root rot and crown discoloration'
    ],
    treatment: [
      'Improve drainage and reduce soil compaction',
      'Use resistant varieties where available',
      'Fungicide seed treatments may help establishment'
    ],
    prevention: [
      'Rotate crops',
      'Manage soybean cyst nematode',
      'Avoid excessive early-season stress'
    ],
    severity: 'high',
    affectedCrops: ['soybean']
  },
  'Yellow Mosaic': {
    name: 'Yellow Mosaic',
    description:
      'Viral disease (often soybean mosaic virus) spread by aphids, causing mottled yellow and green patterns on leaves.',
    symptoms: ['Mottled light and dark green areas', 'Leaf distortion', 'Stunted growth in severe cases'],
    treatment: [
      'Control aphid vectors where practical',
      'Remove nearby virus reservoirs if identified'
    ],
    prevention: [
      'Use virus-free seed',
      'Plant resistant varieties',
      'Manage weeds that host the virus'
    ],
    severity: 'medium',
    affectedCrops: ['soybean']
  },

  // Wheat Diseases
  'Stem Rust': {
    name: 'Stem Rust (Black Rust)',
    description:
      'A fungal disease (Puccinia graminis) producing dark red-brown pustules on stems and leaves; historically capable of destroying entire wheat crops.',
    symptoms: ['Dark reddish-brown pustules that rupture the stem surface', 'Pustules turn black as the plant matures', 'Weakened, lodging stems and shriveled grain'],
    treatment: [
      'Apply triazole fungicides at first sign',
      'Use resistant varieties (e.g. Sr genes)',
      'Destroy volunteer wheat and barberry (alternate host)'
    ],
    prevention: [
      'Plant stem-rust-resistant cultivars',
      'Avoid late planting',
      'Monitor regional rust race alerts (e.g. Ug99)'
    ],
    severity: 'high',
    affectedCrops: ['wheat']
  },
  'Septoria': {
    name: 'Septoria Leaf Blotch',
    description:
      'A fungal disease (Zymoseptoria tritici) causing irregular blotches with tiny black fruiting bodies; a leading cause of wheat yield loss in temperate regions.',
    symptoms: ['Irregular tan-to-brown blotches with yellow margins', 'Small black specks (pycnidia) within lesions', 'Lower leaves affected first, progressing upward'],
    treatment: [
      'Apply fungicides at flag-leaf emergence',
      'Rotate fungicide modes of action (resistance is common)',
      'Bury infected stubble with tillage'
    ],
    prevention: [
      'Plant resistant varieties',
      'Rotate crops and manage residue',
      'Avoid excessively dense stands'
    ],
    severity: 'medium',
    affectedCrops: ['wheat']
  },
  'Loose Smut': {
    name: 'Loose Smut',
    description:
      'A seed-borne fungal disease (Ustilago tritici) that replaces grain heads with masses of black spores.',
    symptoms: ['Heads emerge as masses of black powdery spores', 'Spores blow away leaving bare rachis', 'Infected plants often head slightly early'],
    treatment: [
      'No in-season cure — rogue and destroy infected heads',
      'Use systemic fungicide seed treatments next season',
      'Source certified disease-free seed'
    ],
    prevention: [
      'Plant treated, certified seed',
      'Use resistant varieties',
      'Do not save seed from infected fields'
    ],
    severity: 'medium',
    affectedCrops: ['wheat']
  },
  'Fusarium Head Blight': {
    name: 'Fusarium Head Blight (Scab)',
    description:
      'A fungal disease (Fusarium graminearum) infecting wheat heads, reducing yield and contaminating grain with mycotoxins (DON/vomitoxin).',
    symptoms: ['Bleached, prematurely white spikelets', 'Pink-orange spore masses at the base of florets', 'Shriveled, chalky "tombstone" kernels'],
    treatment: [
      'Apply triazole fungicides at early flowering',
      'Harvest promptly and adjust combine to blow out light scabby kernels',
      'Test grain for DON before use'
    ],
    prevention: [
      'Plant moderately resistant varieties',
      'Rotate away from corn and wheat residue (inoculum sources)',
      'Avoid flowering during prolonged wet periods where possible'
    ],
    severity: 'high',
    affectedCrops: ['wheat']
  },
  'Leaf Rust': {
    name: 'Leaf Rust',
    description: 'A fungal disease causing orange-brown pustules on wheat leaves.',
    symptoms: ['Orange-brown pustules', 'Yellowing around pustules', 'Reduced grain fill'],
    treatment: [
      'Apply fungicides early in the season',
      'Use resistant varieties',
      'Proper timing of applications'
    ],
    prevention: [
      'Plant rust-resistant varieties',
      'Avoid late planting',
      'Maintain proper plant nutrition'
    ],
    severity: 'high',
    affectedCrops: ['wheat']
  },
  'Powdery Mildew': {
    name: 'Powdery Mildew',
    description: 'A fungal disease causing white powdery growth on wheat leaves.',
    symptoms: ['White powdery patches', 'Leaf yellowing', 'Reduced photosynthesis'],
    treatment: [
      'Apply fungicides containing tebuconazole',
      'Improve air circulation',
      'Use resistant varieties'
    ],
    prevention: [
      'Plant resistant varieties',
      'Avoid dense planting',
      'Proper nitrogen management'
    ],
    severity: 'medium',
    affectedCrops: ['wheat', 'tomato']
  },
  'Stripe (Yellow) Rust': {
    name: 'Stripe (Yellow) Rust',
    description: 'A fungal disease causing yellow-orange stripes on wheat leaves, also known as yellow rust.',
    symptoms: ['Yellow-orange stripes on leaves', 'Pustules arranged in lines', 'Premature leaf death', 'Reduced grain quality'],
    treatment: [
      'Apply fungicides like propiconazole or tebuconazole',
      'Use resistant varieties',
      'Early season treatment is most effective'
    ],
    prevention: [
      'Plant stripe rust-resistant varieties',
      'Avoid early planting in high-risk areas',
      'Monitor fields regularly during cool, wet conditions',
      'Practice crop rotation'
    ],
    severity: 'high',
    affectedCrops: ['wheat']
  },
  
  // Tomato Diseases
  'Bacterial Spot': {
    name: 'Bacterial Spot',
    description:
      'A bacterial disease (Xanthomonas spp.) causing small dark greasy-looking spots on leaves and fruit; spreads fast in warm, wet weather.',
    symptoms: ['Small dark water-soaked spots on leaves', 'Spots with yellow halos that turn brown', 'Raised scabby spots on fruit'],
    treatment: [
      'Apply copper-based bactericides early',
      'Remove and destroy infected plants and debris',
      'Avoid overhead watering'
    ],
    prevention: [
      'Use certified disease-free seed and transplants',
      'Rotate away from tomato/pepper for 2 years',
      'Avoid handling plants when wet'
    ],
    severity: 'high',
    affectedCrops: ['tomato']
  },
  'Early Blight': {
    name: 'Early Blight',
    description:
      'A fungal disease (Alternaria solani) producing target-like concentric rings on lower leaves first; thrives on stressed plants.',
    symptoms: ['Brown spots with concentric rings on older leaves', 'Yellowing around lesions', 'Stem lesions and fruit rot near the calyx'],
    treatment: [
      'Apply fungicides containing chlorothalonil or copper',
      'Remove affected lower leaves',
      'Mulch to stop soil splash'
    ],
    prevention: [
      'Stake or cage plants for airflow',
      'Water at the base, not the foliage',
      'Rotate crops and remove plant debris'
    ],
    severity: 'medium',
    affectedCrops: ['tomato']
  },
  'Late Blight': {
    name: 'Late Blight',
    description:
      'The most destructive tomato disease (Phytophthora infestans — the Irish potato famine pathogen); can kill plants within days in cool wet weather.',
    symptoms: ['Large gray-green water-soaked patches on leaves', 'White fuzzy growth on leaf undersides', 'Firm brown blotches on fruit'],
    treatment: [
      'Apply fungicides immediately (chlorothalonil, mancozeb)',
      'Remove and bag infected plants — do not compost',
      'Alert neighboring growers; spores travel miles'
    ],
    prevention: [
      'Plant resistant varieties',
      'Avoid overhead irrigation',
      'Destroy volunteer tomatoes and potatoes'
    ],
    severity: 'high',
    affectedCrops: ['tomato']
  },
  'Leaf Mold': {
    name: 'Leaf Mold',
    description:
      'A fungal disease (Passalora fulva) of humid environments, especially greenhouses and dense canopies.',
    symptoms: ['Pale yellow spots on upper leaf surface', 'Olive-green velvety mold underneath', 'Leaves wither but often stay attached'],
    treatment: [
      'Improve ventilation and lower humidity',
      'Apply fungicides if spreading',
      'Remove infected leaves carefully'
    ],
    prevention: [
      'Space plants generously',
      'Water early in the day at the base',
      'Use resistant varieties in greenhouses'
    ],
    severity: 'medium',
    affectedCrops: ['tomato']
  },
  'Septoria Leaf Spot': {
    name: 'Septoria Leaf Spot',
    description:
      'A fungal disease (Septoria lycopersici) causing many small circular spots, usually starting on the lowest leaves after fruit set.',
    symptoms: ['Many small circular spots with dark borders and gray centers', 'Tiny black dots (fruiting bodies) in spot centers', 'Progressive upward defoliation'],
    treatment: [
      'Apply chlorothalonil or copper fungicides',
      'Remove infected lower leaves',
      'Mulch to reduce soil splash'
    ],
    prevention: [
      'Rotate crops (3-year cycle)',
      'Control weeds in the nightshade family',
      'Avoid working among wet plants'
    ],
    severity: 'medium',
    affectedCrops: ['tomato']
  },
  'Spider Mites': {
    name: 'Spider Mites (Two-Spotted)',
    description:
      'Not a disease but a pest: tiny mites (Tetranychus urticae) that suck cell contents, thriving in hot dry conditions.',
    symptoms: ['Fine yellow stippling on leaves', 'Bronzed or scorched leaf appearance', 'Fine webbing under leaves in heavy infestations'],
    treatment: [
      'Spray plants forcefully with water to dislodge mites',
      'Apply insecticidal soap or horticultural oil',
      'Use miticides only for severe infestations (mites resist quickly)'
    ],
    prevention: [
      'Keep plants well watered (drought stress invites mites)',
      'Encourage predatory mites and beneficial insects',
      'Avoid broad-spectrum insecticides that kill predators'
    ],
    severity: 'medium',
    affectedCrops: ['tomato']
  },
  'Yellow Leaf Curl Virus': {
    name: 'Tomato Yellow Leaf Curl Virus',
    description:
      'A devastating whitefly-transmitted virus; infected young plants may produce almost no fruit. There is no cure once infected.',
    symptoms: ['Upward curling and yellowing of leaf edges', 'Severely stunted plants', 'Flower drop and few, small fruit'],
    treatment: [
      'No cure — remove and bag infected plants immediately',
      'Control whiteflies (sticky traps, insecticidal soap)',
      'Protect remaining plants with fine insect netting'
    ],
    prevention: [
      'Plant TYLCV-resistant varieties',
      'Use reflective mulches to repel whiteflies',
      'Keep the area free of whitefly host weeds'
    ],
    severity: 'high',
    affectedCrops: ['tomato']
  },
  'Mosaic Virus': {
    name: 'Tomato Mosaic Virus',
    description:
      'A highly stable, contact-spread virus causing mottled foliage and reduced yield; survives in debris and on tools and hands.',
    symptoms: ['Light and dark green mosaic mottling on leaves', 'Distorted, fern-like young leaves', 'Internal browning of fruit'],
    treatment: [
      'No cure — remove and destroy infected plants',
      'Disinfect tools and wash hands after handling',
      'Do not smoke near plants (tobacco can carry the virus)'
    ],
    prevention: [
      'Use resistant varieties and certified seed',
      'Disinfect stakes and cages between seasons',
      'Control aphids and handle plants minimally'
    ],
    severity: 'high',
    affectedCrops: ['tomato']
  },

  // Healthy
  'Healthy': {
    name: 'Healthy',
    description: 'No disease detected. The plant appears to be in good health.',
    symptoms: [],
    treatment: [],
    prevention: [
      'Continue monitoring regularly',
      'Maintain proper plant nutrition',
      'Practice good field hygiene',
      'Use preventive measures'
    ],
    severity: 'low',
    affectedCrops: ['corn', 'rice', 'soybean', 'wheat', 'tomato']
  }
}

export function getDiseaseInfo(diseaseName: string, crop: string): DiseaseInfo | null {
  // Try exact match first
  if (DISEASE_INFO[diseaseName]) {
    const info = DISEASE_INFO[diseaseName]
    if (info.affectedCrops.includes(crop) || info.affectedCrops.length === 0) {
      return info
    }
  }
  
  // Try case-insensitive match
  const lowerName = diseaseName.toLowerCase()
  for (const [key, info] of Object.entries(DISEASE_INFO)) {
    if (key.toLowerCase() === lowerName || info.name.toLowerCase() === lowerName) {
      if (info.affectedCrops.includes(crop) || info.affectedCrops.length === 0) {
        return info
      }
    }
  }
  
  // Return generic info if not found
  return {
    name: diseaseName,
    description: `Information about ${diseaseName} for ${crop}.`,
    symptoms: ['Consult agricultural extension services for specific symptoms'],
    treatment: ['Consult with agricultural experts for treatment recommendations'],
    prevention: ['Practice good field hygiene', 'Monitor regularly', 'Use resistant varieties when available'],
    severity: 'medium',
    affectedCrops: [crop]
  }
}
