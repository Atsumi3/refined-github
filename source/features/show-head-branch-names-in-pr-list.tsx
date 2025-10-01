import React from 'dom-chef';
import * as pageDetect from 'github-url-detection';
import GitBranchIcon from 'octicons-plain-react/GitBranch';
import batchedFunction from 'batched-function';

import features from '../feature-manager.js';
import api from '../github-helpers/api.js';
import {buildRepoURL} from '../github-helpers/index.js';
import observe from '../helpers/selector-observer.js';
import {expectToken} from '../github-helpers/github-token.js';

type HeadBranchInfo = {
	headRef: {
		name: string;
		id: string;
	} | undefined;
	headRefName: string;
	headRepository: {
		nameWithOwner: string;
	} | undefined;
};

function buildQuery(issueIds: string[]): string {
	return `
		repository() {
			${issueIds.map(id => `
				${id}: pullRequest(number: ${id.replaceAll(/\D/g, '')}) {
					headRef {
						name
						id
					}
					headRefName
					headRepository {
						nameWithOwner
					}
				}
			`).join('\n')}
		}
	`;
}

async function add(prLinks: HTMLElement[]): Promise<void> {
	const query = buildQuery(prLinks.map(pr => pr.id));
	const data = await api.v4(query);

	for (const prLink of prLinks) {
		const pr: HeadBranchInfo = data.repository[prLink.id];

		// Skip if we don't have head branch info
		if (!pr.headRefName) {
			continue;
		}

		// Build branch URL - if it's from a fork, we need to link to the fork
		let branchUrl: string | undefined;
		if (pr.headRef && pr.headRepository) {
			const [owner, repo] = pr.headRepository.nameWithOwner.split('/');
			branchUrl = `https://github.com/${owner}/${repo}/tree/${pr.headRefName}`;
		} else if (pr.headRef) {
			// Same repository branch
			branchUrl = buildRepoURL('tree', pr.headRefName);
		}

		// Find the metadata section where we should add the branch info
		const metadataContainer = prLink.parentElement!.querySelector('.text-small.color-fg-muted .d-none.d-md-inline-flex');
		if (!metadataContainer) {
			continue;
		}

		metadataContainer.prepend(
			<span className="issue-meta-section mr-2">
				<GitBranchIcon className="color-fg-muted" />
				{' '}
				<span
					className="commit-ref css-truncate user-select-contain mb-n1"
					style={branchUrl ? {} : {textDecoration: 'line-through'}}
				>
					{branchUrl
						? (
								<a title={pr.headRefName} href={branchUrl}>
									{pr.headRefName}
								</a>
							)
						: (
								<span title="Deleted">{pr.headRefName}</span>
							)}
				</span>
			</span>,
		);
	}
}

async function init(signal: AbortSignal): Promise<false | void> {
	await expectToken();
	observe('.js-issue-row .js-navigation-open[data-hovercard-type="pull_request"]', batchedFunction(add, {delay: 100}), {signal});
}

void features.add(import.meta.url, {
	include: [
		pageDetect.isRepoIssueOrPRList,
	],
	init,
});

/*

Test URLs:

https://github.com/refined-github/sandbox/pulls

*/
