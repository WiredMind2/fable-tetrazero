import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const projects = defineCollection({
	loader: file('src/data/projects.json'),
	schema: z.object({
		id: z.number(),
		title: z.string(),
		description: z.string(),
		longDescription: z.string(),
		techStack: z.array(z.string()),
		githubUrl: z.string().url(),
		featured: z.boolean(),
		category: z.enum(['web', 'fullstack', 'other']),
	}),
});

const experiences = defineCollection({
	loader: file('src/data/experiences.json'),
	schema: z.object({
		id: z.string(),
		group: z.enum(['work', 'research', 'competition', 'leadership', 'education']),
		title: z.string(),
		org: z.string(),
		period: z.string(),
		description: z.string(),
		achievements: z.array(z.string()),
		technologies: z.array(z.string()),
	}),
});

export const collections = { projects, experiences };
