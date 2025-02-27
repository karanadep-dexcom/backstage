/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import {
  MockAnalyticsApi,
  TestApiProvider,
  wrapInTestApp,
} from '@backstage/test-utils';
import { analyticsApiRef, configApiRef } from '@backstage/core-plugin-api';
import { isExternalUri, Link, useResolvedPath } from './Link';
import { Route, Routes } from 'react-router-dom';
import { renderHook, WrapperComponent } from '@testing-library/react-hooks';
import { ConfigReader } from '@backstage/config';

describe('<Link />', () => {
  it('navigates using react-router', async () => {
    const testString = 'This is test string';
    const linkText = 'Navigate!';
    const { getByText } = render(
      wrapInTestApp(
        <>
          <Link to="/test">{linkText}</Link>
          <Routes>
            <Route path="/test" element={<p>{testString}</p>} />
          </Routes>
        </>,
      ),
    );
    expect(() => getByText(testString)).toThrow();
    fireEvent.click(getByText(linkText));
    await waitFor(() => {
      expect(getByText(testString)).toBeInTheDocument();
    });
  });

  it('captures click using analytics api', async () => {
    const linkText = 'Navigate!';
    const analyticsApi = new MockAnalyticsApi();
    const customOnClick = jest.fn();

    const { getByText } = render(
      wrapInTestApp(
        <TestApiProvider apis={[[analyticsApiRef, analyticsApi]]}>
          <Link to="/test" onClick={customOnClick}>
            {linkText}
          </Link>
        </TestApiProvider>,
      ),
    );

    fireEvent.click(getByText(linkText));

    // Analytics event should have been fired.
    await waitFor(() => {
      expect(analyticsApi.getEvents()[0]).toMatchObject({
        action: 'click',
        subject: linkText,
        attributes: {
          to: '/test',
        },
      });

      // Custom onClick handler should have still been fired too.
      expect(customOnClick).toHaveBeenCalled();
    });
  });

  it('does not capture click when noTrack is set', async () => {
    const linkText = 'Navigate!';
    const analyticsApi = new MockAnalyticsApi();
    const customOnClick = jest.fn();

    const { getByText } = render(
      wrapInTestApp(
        <TestApiProvider apis={[[analyticsApiRef, analyticsApi]]}>
          <Link to="/test" onClick={customOnClick} noTrack>
            {linkText}
          </Link>
        </TestApiProvider>,
      ),
    );

    fireEvent.click(getByText(linkText));

    // Analytics event should have been fired.
    await waitFor(() => {
      // Custom onClick handler should have been fired.
      expect(customOnClick).toHaveBeenCalled();

      // But there should be no analytics event.
      expect(analyticsApi.getEvents()).toHaveLength(0);
    });
  });

  describe('isExternalUri', () => {
    it.each([
      [true, 'http://'],
      [true, 'https://'],
      [true, 'https://some-host'],
      [true, 'https://some-host/path#fragment'],
      [true, 'https://some-host/path?param1=value'],
      [true, 'slack://'],
      [true, 'mailto:foo@example.org'],
      [true, 'ms-help://'],
      [true, 'ms.help://'],
      [true, 'ms+help://'],
      [false, '//'],
      [false, '123://'],
      [false, 'abc&xzy://'],
      [false, 'http'],
      [false, 'path/to'],
      [false, 'path/to/something#fragment'],
      [false, 'path/to/something?param1=value'],
      [false, '/path/to/something'],
      [false, '/path/to/something#fragment'],
    ])('should be %p when %p', (expected, uri) => {
      expect(isExternalUri(uri)).toBe(expected);
    });
  });

  describe('useResolvedPath', () => {
    const wrapper: WrapperComponent<React.PropsWithChildren<{}>> = ({
      children,
    }) => {
      const configApi = new ConfigReader({
        app: { baseUrl: 'http://localhost:3000/example' },
      });
      return (
        <TestApiProvider apis={[[configApiRef, configApi]]}>
          {children}
        </TestApiProvider>
      );
    };

    describe('concatenate base path', () => {
      it('when uri is internal and does not start with base path', () => {
        const path = '/catalog/default/component/artist-lookup';
        const { result } = renderHook(() => useResolvedPath(path), {
          wrapper,
        });
        expect(result.current).toBe('/example'.concat(path));
      });
    });

    describe('does not concatenate base path', () => {
      it('when uri is external', () => {
        const path = 'https://stackoverflow.com/questions/1/example';
        const { result } = renderHook(() => useResolvedPath(path), {
          wrapper,
        });
        expect(result.current).toBe(path);
      });

      it('when uri already starts with base path', () => {
        const path = '/example/catalog/default/component/artist-lookup';
        const { result } = renderHook(() => useResolvedPath(path), {
          wrapper,
        });
        expect(result.current).toBe(path);
      });
    });
  });

  it('throws an error when attempting to link to script code', () => {
    expect(() =>
      // eslint-disable-next-line no-script-url
      render(wrapInTestApp(<Link to="javascript:alert('hello')">Script</Link>)),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Link component rejected javascript: URL as a security precaution"`,
    );
  });
});

describe('window.open', () => {
  it('throws an error when attempting to open script code', () => {
    expect(() =>
      // eslint-disable-next-line no-script-url
      window.open("javascript:alert('hello')"),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Rejected window.open() with a javascript: URL as a security precaution"`,
    );
  });
});
