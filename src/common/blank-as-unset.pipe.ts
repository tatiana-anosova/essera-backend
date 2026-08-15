import { Injectable, PipeTransform } from '@nestjs/common';

/** `?param=` with no value means "no filter", rather than an invalid enum value. */
@Injectable()
export class BlankAsUnsetPipe implements PipeTransform<string | undefined> {
  transform(value: string | undefined) {
    return value === '' ? undefined : value;
  }
}
